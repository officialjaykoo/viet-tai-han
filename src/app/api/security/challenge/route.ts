import { NextRequest, NextResponse } from "next/server";

import {
  ATK_COOKIE,
  SEC_COOKIE,
  CHALLENGE_TTL_MS,
  clientIpFromHeaders,
  mintChallenge,
  sealSecCookie,
} from "@/lib/security/challenge";
import {
  GATE_NAME_COOKIE,
  GATE_VALUE_COOKIE,
} from "@/lib/security/shared";
import { checkSubjectRateLimit } from "@/lib/rate-limit";
import { jsonLocalizedError } from "@/lib/public-error";

export const dynamic = "force-dynamic";

/** Issue a one-time API challenge + dynamic cookies for request signing. */
export async function GET(request: NextRequest) {
  try {
    const ip = clientIpFromHeaders(request.headers);
    const limited = await checkSubjectRateLimit({
      subject: `ip:${ip}`,
      action: "challenge",
      limit: 20,
      windowSeconds: 60,
    });
    if (!limited.allowed) {
      return await jsonLocalizedError("Too many challenge requests", 429);
    }

    const challenge = await mintChallenge(ip);
    const sealedSec = await sealSecCookie(challenge.sec);

    const response = NextResponse.json({
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt,
      powDifficulty: challenge.powDifficulty,
      // Opaque gate for /i/api query string — name and value are server-random.
      n: challenge.gate.name,
      v: challenge.gate.value,
    });

    const maxAge = Math.ceil(CHALLENGE_TTL_MS / 1000);
    const secure =
      request.nextUrl.protocol === "https:" ||
      process.env.NODE_ENV === "production";

    response.cookies.set(ATK_COOKIE, challenge.atk, {
      httpOnly: false,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    response.cookies.set(SEC_COOKIE, sealedSec, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    response.cookies.set(GATE_NAME_COOKIE, challenge.gate.name, {
      httpOnly: false,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    response.cookies.set(GATE_VALUE_COOKIE, challenge.gate.value, {
      httpOnly: false,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("GET /api/security/challenge failed", error);
    return await jsonLocalizedError("Could not issue challenge", 500);
  }
}
