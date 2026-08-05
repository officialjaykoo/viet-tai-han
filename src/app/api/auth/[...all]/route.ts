import { getAuth } from "@/lib/auth";
import { HUMAN_COOKIE, openHumanToken } from "@/lib/security/human-cookie";

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

function needsHumanGate(pathname: string): boolean {
  return (
    pathname.includes("/sign-in") ||
    pathname.includes("/sign-up") ||
    pathname.includes("/sign-in/username") ||
    pathname.includes("/sign-up/email")
  );
}

/**
 * Better Auth handler. Reachable only via POST /i/api tunnel (or public API key).
 * Logical path: /api/auth/*
 */
export async function GET(request: Request) {
  const auth = await getAuth();
  return auth.handler(request);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (needsHumanGate(url.pathname)) {
    const raw = readCookie(request.headers.get("cookie"), HUMAN_COOKIE);
    const opened = await openHumanToken(raw);
    if (!opened) {
      return Response.json(
        { message: "Could not verify request" },
        { status: 403 }
      );
    }
  }

  const auth = await getAuth();
  return auth.handler(request);
}
