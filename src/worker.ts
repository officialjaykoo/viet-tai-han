/**
 * Custom OpenNext worker entry.
 * Edge rate limits run BEFORE OpenNext/Next so flood traffic dies cheaply
 * (no SSR, D1, or AI) and cannot inflate bills.
 * PostObject lives in this same Worker (no separate DO script).
 * @see https://opennext.js.org/cloudflare/howtos/custom-worker
 * @see https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
 */

export { PostObject } from "./workers/PostObject";

// `.open-next/worker.js` is produced by `opennextjs-cloudflare build`
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

      const response = await handler.fetch(request, env, ctx);

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
