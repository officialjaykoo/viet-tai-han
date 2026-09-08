import { NextRequest, NextResponse } from "next/server";

import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { parseProfilePatch } from "@/lib/settings-payload";
import { updateUserProfileAndUsername } from "@/lib/username-lifecycle";
import { readApiJson } from "@/lib/security/guard";

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    const parsed = parseProfilePatch(await readApiJson(request));
    if (!parsed.ok) {
      return await jsonLocalizedError("Invalid profile payload", 400);
    }

    const settings = await updateUserProfileAndUsername({
      userId: session.user.id,
      ...parsed.value,
    });
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("PATCH /api/me/profile failed", error);
    return await jsonLocalizedError("Failed to save profile", 500);
  }
}
