import { NextRequest, NextResponse } from "next/server";

import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { readApiJson } from "@/lib/security/guard";
import { updateUserProfileAndUsername } from "@/lib/username-lifecycle";

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await readApiJson(request).catch(() => null)) as {
      username?: string;
      name?: string;
      bio?: string | null;
      image?: string | null;
      bannerKey?: string | null;
    } | null;

    if (!body || typeof body !== "object") {
      return await jsonLocalizedError("Profile data is required", 400);
    }

    const settings = await updateUserProfileAndUsername({
      userId: session.user.id,
      username: body.username,
      name: body.name,
      bio: body.bio,
      image: body.image,
      bannerKey: body.bannerKey,
    });
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("PATCH /api/me/profile failed", error);
    return await jsonLocalizedError("Failed to save profile", 500);
  }
}
