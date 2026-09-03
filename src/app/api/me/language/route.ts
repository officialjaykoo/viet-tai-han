import { NextRequest, NextResponse } from "next/server";

import { isLocale } from "@/lib/i18n/config";
import { jsonLocalizedError } from "@/lib/public-error";
import { setUserPreferredLanguage } from "@/lib/user-language";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { readApiJson } from "@/lib/security/guard";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await readApiJson(request).catch(() => null)) as {
      preferredLanguage?: string;
    } | null;

    if (!isLocale(body?.preferredLanguage)) {
      return await jsonLocalizedError(
        "preferredLanguage must be vi or ko",
        400
      );
    }

    const result = await setUserPreferredLanguage(
      session.user.id,
      body.preferredLanguage
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("POST /api/me/language failed", error);
    return await jsonLocalizedError("Could not update language", 500);
  }
}
