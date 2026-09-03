import { NextRequest } from "next/server";

type RouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> }
) => Promise<Response> | Response;

type RouteModule = Record<string, unknown>;

type RouteEntry = {
  methods: string[];
  /** Pattern with `:param` and `*rest` segments. */
  pattern: string;
  load: () => Promise<RouteModule>;
};

function compile(
  pattern: string
): (pathname: string) => Record<string, string> | null {
  const keys: string[] = [];
  const parts = pattern.split("/").filter(Boolean);
  const regexParts = parts.map((part) => {
    if (part.startsWith(":")) {
      keys.push(part.slice(1));
      return "([^/]+)";
    }
    if (part.startsWith("*")) {
      keys.push(part.slice(1) || "rest");
      return "(.+)";
    }
    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });
  const re = new RegExp(`^/${regexParts.join("/")}$`);
  return (pathname: string) => {
    const m = pathname.match(re);
    if (!m) return null;
    const params: Record<string, string> = {};
    keys.forEach((key, i) => {
      params[key] = decodeURIComponent(m[i + 1] ?? "");
    });
    return params;
  };
}

/**
 * Logical app routes reachable via POST /i/api.
 * Paths stay under `/api/...` as internal handler locations.
 */
const ROUTES: RouteEntry[] = [
  {
    methods: ["GET"],
    pattern: "/api/security/challenge",
    load: () => import("@/app/api/security/challenge/route"),
  },
  {
    methods: ["POST"],
    pattern: "/api/security/bot-check",
    load: () => import("@/app/api/security/bot-check/route"),
  },
  {
    methods: ["GET", "POST"],
    pattern: "/api/posts",
    load: () => import("@/app/api/posts/route"),
  },
  {
    methods: ["GET", "PATCH", "DELETE"],
    pattern: "/api/posts/:id",
    load: () => import("@/app/api/posts/[id]/route"),
  },
  {
    methods: ["POST"],
    pattern: "/api/posts/:id/comments",
    load: () => import("@/app/api/posts/[id]/comments/route"),
  },
  {
    methods: ["POST"],
    pattern: "/api/posts/:id/vote",
    load: () => import("@/app/api/posts/[id]/vote/route"),
  },
  {
    methods: ["POST"],
    pattern: "/api/posts/:id/view",
    load: () => import("@/app/api/posts/[id]/view/route"),
  },
  {
    methods: ["POST", "DELETE"],
    pattern: "/api/posts/:id/hide",
    load: () => import("@/app/api/posts/[id]/hide/route"),
  },
  {
    methods: ["POST"],
    pattern: "/api/posts/:id/report",
    load: () => import("@/app/api/posts/[id]/report/route"),
  },
  {
    methods: ["GET"],
    pattern: "/api/posts/:id/stats",
    load: () => import("@/app/api/posts/[id]/stats/route"),
  },
  {
    methods: ["PATCH", "DELETE"],
    pattern: "/api/comments/:id",
    load: () => import("@/app/api/comments/[id]/route"),
  },
  {
    methods: ["POST"],
    pattern: "/api/comments/:id/vote",
    load: () => import("@/app/api/comments/[id]/vote/route"),
  },
  {
    methods: ["GET", "POST"],
    pattern: "/api/subreddits",
    load: () => import("@/app/api/subreddits/route"),
  },
  {
    methods: ["GET"],
    pattern: "/api/subreddits/:name",
    load: () => import("@/app/api/subreddits/[name]/route"),
  },
  {
    methods: ["POST", "DELETE"],
    pattern: "/api/subreddits/:name/subscribe",
    load: () => import("@/app/api/subreddits/[name]/subscribe/route"),
  },
  {
    methods: ["POST"],
    pattern: "/api/users/:username",
    load: () => import("@/app/api/users/[username]/route"),
  },
  {
    methods: ["POST"],
    pattern: "/api/me/language",
    load: () => import("@/app/api/me/language/route"),
  },
  {
    methods: ["POST"],
    pattern: "/api/me/nsfw",
    load: () => import("@/app/api/me/nsfw/route"),
  },
  {
    methods: ["GET", "PATCH"],
    pattern: "/api/me/settings",
    load: () => import("@/app/api/me/settings/route"),
  },
  {
    methods: ["GET", "POST", "DELETE"],
    pattern: "/api/me/api-keys",
    load: () => import("@/app/api/me/api-keys/route"),
  },
  {
    methods: ["POST"],
    pattern: "/api/media",
    load: () => import("@/app/api/media/route"),
  },
  {
    methods: ["GET"],
    pattern: "/api/media/*key",
    load: () => import("@/app/api/media/[...key]/route"),
  },
  {
    methods: ["GET", "POST"],
    pattern: "/api/auth/*all",
    load: () => import("@/app/api/auth/[...all]/route"),
  },
  {
    methods: ["GET", "POST"],
    pattern: "/api/messages",
    load: () => import("@/app/api/messages/route"),
  },
  {
    methods: ["GET", "POST"],
    pattern: "/api/messages/:roomId",
    load: () => import("@/app/api/messages/[roomId]/route"),
  },
  {
    methods: ["POST"],
    pattern: "/api/messages/requests/:id",
    load: () => import("@/app/api/messages/requests/[id]/route"),
  },
  {
    methods: ["GET", "POST"],
    pattern: "/api/notifications",
    load: () => import("@/app/api/notifications/route"),
  },
  {
    methods: ["GET"],
    pattern: "/api/search",
    load: () => import("@/app/api/search/route"),
  },
  {
    methods: ["GET", "POST"],
    pattern: "/api/listings",
    load: () => import("@/app/api/listings/route"),
  },
  {
    methods: ["GET"],
    pattern: "/api/listings/saved",
    load: () => import("@/app/api/listings/saved/route"),
  },
  {
    methods: ["GET", "PATCH"],
    pattern: "/api/listings/:id",
    load: () => import("@/app/api/listings/[id]/route"),
  },
  {
    methods: ["POST"],
    pattern: "/api/listings/:id/save",
    load: () => import("@/app/api/listings/[id]/save/route"),
  },
  {
    methods: ["POST"],
    pattern: "/api/listings/:id/report",
    load: () => import("@/app/api/listings/[id]/report/route"),
  },
  {
    methods: ["GET", "POST", "DELETE"],
    pattern: "/api/listing-alerts",
    load: () => import("@/app/api/listing-alerts/route"),
  },
  {
    methods: ["GET", "POST"],
    pattern: "/api/businesses",
    load: () => import("@/app/api/businesses/route"),
  },
  {
    methods: ["GET"],
    pattern: "/api/businesses/mine",
    load: () => import("@/app/api/businesses/mine/route"),
  },
  {
    methods: ["GET", "PATCH"],
    pattern: "/api/businesses/:id",
    load: () => import("@/app/api/businesses/[id]/route"),
  },
  {
    methods: ["POST"],
    pattern: "/api/businesses/:id/verification",
    load: () => import("@/app/api/businesses/[id]/verification/route"),
  },
  {
    methods: ["GET", "POST"],
    pattern: "/api/businesses/:id/bookings",
    load: () => import("@/app/api/businesses/[id]/bookings/route"),
  },
  {
    methods: ["PATCH"],
    pattern: "/api/business-bookings/:id",
    load: () => import("@/app/api/business-bookings/[id]/route"),
  },
  {
    methods: ["GET"],
    pattern: "/api/recommendations",
    load: () => import("@/app/api/recommendations/route"),
  },
  {
    methods: ["GET"],
    pattern: "/api/ads",
    load: () => import("@/app/api/ads/route"),
  },
  {
    methods: ["GET"],
    pattern: "/api/ads/:id/click",
    load: () => import("@/app/api/ads/[id]/click/route"),
  },
  {
    methods: ["POST"],
    pattern: "/api/ads/impression",
    load: () => import("@/app/api/ads/impression/route"),
  },
  {
    methods: ["GET"],
    pattern: "/api/posts/:id/out",
    load: () => import("@/app/api/posts/[id]/out/route"),
  },
  {
    methods: ["GET", "POST"],
    pattern: "/api/admin",
    load: () => import("@/app/api/admin/route"),
  },
];

const compiled = ROUTES.map((route) => ({
  ...route,
  match: compile(route.pattern),
}));

/** Next.js catch-all `[...param]` expects `string[]`; convert splat captures. */
function toNextParams(
  pattern: string,
  params: Record<string, string>
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = { ...params };
  for (const part of pattern.split("/")) {
    if (!part.startsWith("*")) continue;
    const key = part.slice(1) || "rest";
    const value = params[key];
    if (typeof value === "string") {
      out[key] = value.split("/");
    }
  }
  return out;
}

export async function dispatchInternalApi(input: {
  request: NextRequest;
  method: string;
  path: string;
  query: string;
  body: Uint8Array;
  contentType?: string | null;
}): Promise<Response> {
  const method = input.method.toUpperCase();
  if (!input.path.startsWith("/api/")) {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }

  for (const route of compiled) {
    if (!route.methods.includes(method)) continue;
    const params = route.match(input.path);
    if (!params) continue;

    const mod = await route.load();
    const handler = mod[method];
    if (typeof handler !== "function") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const url = new URL(input.request.url);
    url.pathname = input.path;
    url.search = input.query ? `?${input.query}` : "";

    const headers = new Headers(input.request.headers);
    headers.delete("content-length");
    const isBinary =
      Boolean(input.contentType) &&
      !input.contentType!.includes("json") &&
      input.body.byteLength > 0;
    if (isBinary) {
      headers.set("content-type", input.contentType!);
    } else if (input.body.byteLength > 0) {
      headers.set("content-type", "application/json");
    } else {
      headers.delete("content-type");
    }

    const hasBody = !["GET", "HEAD"].includes(method) && input.body.byteLength > 0;
    const inner = new NextRequest(url, {
      method,
      headers,
      body: hasBody ? new Uint8Array(input.body) : undefined,
    });

    return (handler as RouteHandler)(inner, {
      params: Promise.resolve(toNextParams(route.pattern, params)),
    });
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}
