import { getAuth } from "@/lib/auth";
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


/**
 * Better Auth handler. Reachable only via POST /i/api tunnel (or public API key).
 * Logical path: /api/auth/*
 */
export async function GET(request: Request) {
  const rejected = await rejectNonHuman(request);
  if (rejected) return rejected;

  const auth = await getAuth();
  return auth.handler(request);
}

export async function POST(request: Request) {
  const rejected = await rejectNonHuman(request);
  if (rejected) return rejected;

  const auth = await getAuth();
  return auth.handler(request);
}
