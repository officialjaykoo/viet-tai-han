import {
  fakeNotFoundResponse,
  htmlErrorIfBrowser,
  isHiddenPath,
} from "./http-errors";

export type WorkerIngressEnv = {
  E2E_BOT_BYPASS?: string;
};

/**
 * Protects requests before they reach the OpenNext handler.
 * Returns a response when the request is handled, otherwise null.
 */
export function guardWorkerRequest(
  request: Request,
  env: WorkerIngressEnv = {}
): Response | null {
  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase();

  if (isHiddenPath(pathname)) {
    if (pathname === "/i/api" && method === "POST") return null;
    return fakeNotFoundResponse();
  }

  if (
    method === "GET" &&
    (pathname.startsWith("/api/auth/callback/") ||
      pathname.startsWith("/api/auth/oauth2/callback/"))
  ) {
    return null;
  }

  if (
    env.E2E_BOT_BYPASS === "1" &&
    method === "POST" &&
    pathname === "/api/auth/e2e-session"
  ) {
    return null;
  }

  if (pathname === "/api/billing/webhook") return null;
  if (!pathname.startsWith("/api/")) return null;

  const auth = request.headers.get("authorization") ?? "";
  if (/^Bearer\s+\S+/i.test(auth)) return null;

  const html = htmlErrorIfBrowser(request, "not_found");
  if (html) return html;

  return Response.json(
    {
      error: "API key required",
      hint: "Public /api requires Authorization: Bearer <api_key>.",
    },
    { status: 401 }
  );
}
