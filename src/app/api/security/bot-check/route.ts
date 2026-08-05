import { NextRequest, NextResponse } from "next/server";

import { clientIpFromHeaders } from "@/lib/security/challenge";
import {
  evaluateAttestation,
  type BotAttestation,
} from "@/lib/security/bot-signals";
import { checkSubjectRateLimit } from "@/lib/rate-limit";
import { randomToken } from "@/lib/security/crypto";
import {
  HUMAN_COOKIE,
  HUMAN_TTL_MS,
  sealHumanToken,
} from "@/lib/security/human-cookie";
import { jsonLocalizedError } from "@/lib/public-error";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

export const dynamic = "force-dynamic";

/** Validate client attestation + Turnstile, then mint a short-lived human cookie. */
export async function POST(request: NextRequest) {
  try {
    const ip = clientIpFromHeaders(request.headers);
    const limited = await checkSubjectRateLimit({
      subject: `ip:${ip}`,
      action: "bot-check",
      limit: 15,
      windowSeconds: 60,
    });
    if (!limited.allowed) {
      return await jsonLocalizedError("Too many requests", 429);
    }

    const body = (await request.json()) as {
      attestation?: BotAttestation;
      turnstileToken?: string;
    };

    const turnstile = await verifyTurnstileToken(body?.turnstileToken, ip);
    if (!turnstile.ok) {
      return NextResponse.json(
        { success: false, error: "Turnstile verification failed" },
        { status: 403 }
      );
    }

    const result = evaluateAttestation(body?.attestation);
    if (!result.ok) {
      return NextResponse.json({ success: false }, { status: 403 });
    }

    const expires = Date.now() + HUMAN_TTL_MS;
    const nonce = randomToken(8);
    const sealed = await sealHumanToken(`${expires}:${nonce}`);

    const response = NextResponse.json({ success: true, expiresAt: expires });
    const secure =
      request.nextUrl.protocol === "https:" ||
      process.env.NODE_ENV === "production";
    response.cookies.set(HUMAN_COOKIE, sealed, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: Math.ceil(HUMAN_TTL_MS / 1000),
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("POST /api/security/bot-check failed", error);
    return await jsonLocalizedError("Could not verify request", 500);
  }
}
