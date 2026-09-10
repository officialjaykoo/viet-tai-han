import { NextRequest, NextResponse } from "next/server";

import {
  getUserSettings,
  listBlockedUsers,
  updateUserContactEmail,
  updateUserPreferences,
  updateUserProfile,
} from "@/lib/user-settings";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
import { parseSettingsPatch } from "@/lib/settings-payload";
import { readApiJson } from "@/lib/security/guard";

export async function GET() {
  try {
    const session = await requireSession();
    const [settings, blocked] = await Promise.all([
      getUserSettings(session.user.id),
      listBlockedUsers(session.user.id),
    ]);
    if (!settings) {
      return await jsonLocalizedError("Not found", 404);
    }
    return NextResponse.json({ settings, blocked });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("GET /api/me/settings failed", error);
    return await jsonLocalizedError("Failed to load", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    const parsed = parseSettingsPatch(await readApiJson(request));
    if (!parsed.ok) {
      return await jsonLocalizedError(parsed.error, 400);
    }

    const body = parsed.value;
    if (body.section === "profile") {
      const settings = await updateUserProfile({
        userId: session.user.id,
        name: body.name,
        bio: body.bio,
        image: body.image,
        bannerKey: body.bannerKey,
      });
      return NextResponse.json({ settings });
    }

    if (body.section === "contactEmail") {
      const result = await updateUserContactEmail(
        session.user.id,
        body.contactEmail
      );
      return NextResponse.json(result);
    }

    const settings = await updateUserPreferences({
      userId: session.user.id,
      theme: body.theme,
      preferredLanguage: body.preferredLanguage,
      allowDms: body.allowDms,
      notifyComments: body.notifyComments,
      notifyFollows: body.notifyFollows,
      notifyChat: body.notifyChat,
      notifyMentions: body.notifyMentions,
    });
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("PATCH /api/me/settings failed", error);
    return await jsonLocalizedError("Failed to save", 500);
  }
}
