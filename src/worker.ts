/**
 * Custom OpenNext worker entry.
 * Edge rate limits run BEFORE OpenNext/Next so flood traffic dies cheaply
 * (no SSR, D1, or AI) and cannot inflate bills.
 * PostObject lives in this same Worker (no separate DO script).
 * @see https://opennext.js.org/cloudflare/howtos/custom-worker
 * @see https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
 */

import { createAuth } from "./lib/auth";
import { ChatRoom } from "./workers/ChatRoom";
import { PostObject } from "./workers/PostObject";

export { ChatRoom, PostObject };

// `.open-next/worker.js` is produced by `opennextjs-cloudflare build`
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- generated before build
// @ts-ignore — missing until first OpenNext build; present in deploy/preview
import { default as handler } from "../.open-next/worker.js";

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function tooManyRequests(retryAfterSec = 60): Response {
  return new Response("Too Many Requests", {
    status: 429,
    headers: {
      "Retry-After": String(retryAfterSec),
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

type EnvWithLimits = CloudflareEnv & {
  EDGE_IP_RATE_LIMITER?: RateLimit;
  TUNNEL_IP_RATE_LIMITER?: RateLimit;
  EXPENSIVE_IP_RATE_LIMITER?: RateLimit;
};
const REALTIME_PATH = "/api/messages/realtime";
const DEVELOPER_HOST = "developers.vth.kr";

function routeDeveloperRequest(request: Request): Request {
  const url = new URL(request.url);
  const requestHostname = url.hostname.toLowerCase();
  const headerHostname =
    request.headers.get("host")?.split(":")[0].toLowerCase() ?? "";
  const isDeveloperHost =
    requestHostname === DEVELOPER_HOST || headerHostname === DEVELOPER_HOST;

  if (!isDeveloperHost) return request;

  const pathname = url.pathname;
  const isAsset =
    pathname.startsWith("/_next/") ||
    pathname === "/icon.png" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/speculation-rules.json" ||
    /\.[a-z0-9]+$/i.test(pathname);

  if (
    isAsset ||
    pathname === "/developers" ||
    pathname.startsWith("/developers/")
  ) {
    return request;
  }

  url.pathname = pathname === "/" ? "/developers" : `/developers${pathname}`;
  return new Request(url, request);
}

function realtimeJson(data: unknown, status: number): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handleRealtime(
  request: Request,
  env: EnvWithLimits
): Promise<Response> {
  if (
    request.method !== "GET" ||
    request.headers.get("Upgrade")?.toLowerCase() !== "websocket"
  ) {
    return realtimeJson({ error: "WebSocket upgrade required" }, 426);
  }

  const url = new URL(request.url);
  const roomId = url.searchParams.get("room")?.trim();
  if (!roomId || roomId.length > 200) {
    return realtimeJson({ error: "A valid room is required" }, 400);
  }
  if (!env.CHAT_ROOM) {
    return realtimeJson({ error: "Realtime chat is unavailable" }, 503);
  }

  let session: Awaited<ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>>;
  try {
    const auth = createAuth(env.DB, {
      BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: env.BETTER_AUTH_URL,
      VTH_AUTH_ORIGINS: env.VTH_AUTH_ORIGINS,
      FACEBOOK_CLIENT_ID: env.FACEBOOK_CLIENT_ID,
      FACEBOOK_CLIENT_SECRET: env.FACEBOOK_CLIENT_SECRET,
      ZALO_APP_ID: env.ZALO_APP_ID,
      ZALO_APP_SECRET: env.ZALO_APP_SECRET,
      KAKAO_CLIENT_ID: env.KAKAO_CLIENT_ID,
      KAKAO_CLIENT_SECRET: env.KAKAO_CLIENT_SECRET,
    });
    session = await auth.api.getSession({ headers: request.headers });
  } catch (error) {
    console.error("realtime session verification failed", error);
    return realtimeJson({ error: "Unauthorized" }, 401);
  }

  const user = session?.user as { id?: string; status?: string | null } | null;
  if (!user?.id) {
    return realtimeJson({ error: "Unauthorized" }, 401);
  }
  if (user.status === "banned") {
    return realtimeJson({ error: "Forbidden" }, 403);
  }

  const headers = new Headers(request.headers);
  headers.set("X-VTH-User-ID", user.id);
  headers.set("X-VTH-Realtime-Token", env.BETTER_AUTH_SECRET);

  const stub = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(roomId));
  return stub.fetch(new Request(request, { headers }));
}

export default {
  async fetch(
    request: Request,
    env: EnvWithLimits,
    ctx: ExecutionContext
  ): Promise<Response> {
    const ip = clientIp(request);
    const { pathname } = new URL(request.url);

    try {
      // 1) Global per-IP flood gate (SSR pages, assets routed through Worker, etc.)
      if (env.EDGE_IP_RATE_LIMITER) {
        const { success } = await env.EDGE_IP_RATE_LIMITER.limit({ key: ip });
        if (!success) return tooManyRequests(60);
      }

      // 2) Tighter gate for the Protobuf tunnel (crypto + dispatch)
      if (pathname === "/i/api") {
        if (env.TUNNEL_IP_RATE_LIMITER) {
          const { success } = await env.TUNNEL_IP_RATE_LIMITER.limit({ key: ip });
          if (!success) return tooManyRequests(60);
        }
      }

      // 3) Cap expensive logical routes (AI / search / challenge bootstrap)
      if (
        pathname.startsWith("/api/recommendations") ||
        pathname.startsWith("/api/search") ||
        pathname.startsWith("/api/security/challenge") ||
        pathname.startsWith("/recommended")
      ) {
        if (env.EXPENSIVE_IP_RATE_LIMITER) {
          const { success } = await env.EXPENSIVE_IP_RATE_LIMITER.limit({
            key: ip,
          });
          if (!success) return tooManyRequests(60);
        }
      }

      if (pathname === REALTIME_PATH) {
        return await handleRealtime(request, env);
      }

      const appRequest = routeDeveloperRequest(request);
      const response = await handler.fetch(appRequest, env, ctx);

      // Cloudflare Speed Brain injects Speculation-Rules that make Chromium
      // fire Sec-Purpose: prefetch navigations. Those are intentionally refused
      // for Worker routes (503 + cf-speculation-refused) and show up as scary
      // red Network errors even though real navigations return 200.
      // Setting our own empty rules prevents Speed Brain from overriding.
      // @see https://developers.cloudflare.com/speed/optimization/content/speed-brain/
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        const headers = new Headers(response.headers);
        headers.set("Speculation-Rules", '"/speculation-rules.json"');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }

      return response;
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "worker_fetch_failed",
          path: pathname,
          method: request.method,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
      );
      return new Response("Service Unavailable", {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;
