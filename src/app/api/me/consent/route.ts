import { NextRequest, NextResponse } from "next/server";

import { CONSENT_VERSION, saveUserConsent, getUserConsent } from "@/lib/monetization";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { readApiJson } from "@/lib/security/guard";

export async function GET() {
  try {
    const session = await requireSession({ allowIncomplete: true });
    return NextResponse.json({ consent: await getUserConsent(session.user.id) });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/me/consent failed", error);
    return await jsonLocalizedError("Could not load consent", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession({ allowIncomplete: true });
    const body = (await readApiJson(request).catch(() => null)) as {
      consentVersion?: unknown;
      analytics?: unknown;
      personalizedAds?: unknown;
      marketing?: unknown;
    } | null;
    if (
      typeof body?.analytics !== "boolean" ||
      typeof body.personalizedAds !== "boolean" ||
      typeof body.marketing !== "boolean"
    ) {
      return await jsonLocalizedError("Invalid consent choices", 400);
    }
    const consent = await saveUserConsent({
      userId: session.user.id,
      consentVersion:
        typeof body.consentVersion === "string"
          ? body.consentVersion
          : CONSENT_VERSION,
      analytics: body.analytics,
      personalizedAds: body.personalizedAds,
      marketing: body.marketing,
    });
    return NextResponse.json({ consent });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/me/consent failed", error);
    return await jsonLocalizedError("Could not save consent", 500);
  }
}
