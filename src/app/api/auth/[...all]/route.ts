import { getAuth } from "@/lib/auth";
import { stripOAuthCompatibilityFields } from "@/lib/oauth-identity";
import { HUMAN_COOKIE, openHumanToken } from "@/lib/security/human-cookie";

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

function needsHumanGate(pathname: string): boolean {
  return pathname.includes("/sign-in") || pathname.includes("/sign-up");
}
async function rejectNonHuman(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!needsHumanGate(url.pathname)) return null;

  const raw = readCookie(request.headers.get("cookie"), HUMAN_COOKIE);
  const opened = await openHumanToken(raw);
  return opened
    ? null
    : Response.json(
        { message: "Could not verify request" },
        { status: 403 }
      );
}

async function redactSessionResponse(response: Response): Promise<Response> {
  if (!response.ok) return response;
  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return response;
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("user" in body) ||
    !body.user ||
    typeof body.user !== "object"
  ) {
    return response;
  }

  const safeUser = stripOAuthCompatibilityFields(
    body.user as Record<string, unknown>
  );
  const safeBody = { ...(body as Record<string, unknown>), user: safeUser };
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  return new Response(JSON.stringify(safeBody), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleAuthRequest(request: Request): Promise<Response> {
  const rejected = await rejectNonHuman(request);
  if (rejected) return rejected;

  const auth = await getAuth();
  const response = await auth.handler(request);
  return new URL(request.url).pathname.endsWith("/get-session")
    ? redactSessionResponse(response)
    : response;
}

/**
 * Better Auth handler. Reachable only via POST /i/api tunnel (or public API key).
 * Logical path: /api/auth/*
 */
export async function GET(request: Request) {
  return handleAuthRequest(request);
}

export async function POST(request: Request) {
  return handleAuthRequest(request);
}
