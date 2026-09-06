import { NextRequest, NextResponse } from "next/server";

import {
  completeOnboarding,
  getOnboardingState,
} from "@/lib/onboarding";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { readApiJson } from "@/lib/security/guard";

export async function GET() {
  try {
    const session = await requireSession({ allowIncomplete: true });
    const state = await getOnboardingState(session.user.id);
    if (!state) return await jsonLocalizedError("Not found", 404);
    return NextResponse.json({ state });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/me/onboarding failed", error);
    return await jsonLocalizedError("Failed to load", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession({ allowIncomplete: true });
    const body = (await readApiJson(request).catch(() => null)) as {
      name?: string;
      username?: string;
      preferredLanguage?: string;
    } | null;

    if (
      typeof body?.name !== "string" ||
      typeof body.username !== "string" ||
      typeof body.preferredLanguage !== "string"
    ) {
      return await jsonLocalizedError("Onboarding fields are required", 400);
    }

    const state = await completeOnboarding({
      userId: session.user.id,
      name: body.name,
      username: body.username,
      preferredLanguage: body.preferredLanguage,
    });
    return NextResponse.json({ state });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("PATCH /api/me/onboarding failed", error);
    return await jsonLocalizedError("Failed to save", 500);
  }
}
