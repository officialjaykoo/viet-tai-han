import { NextRequest, NextResponse } from "next/server";

import {
  getUserSettings,
  listBlockedUsers,
  updateUserEmail,
  updateUserPreferences,
  updateUserProfile,
  type AllowDms,
  type ThemePreference,
} from "@/lib/user-settings";
import { isLocale } from "@/lib/i18n/config";
import { jsonLocalizedError } from "@/lib/public-error";
import { AuthError, jsonAuthError, requireSession } from "@/lib/session";
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
    const body = (await readApiJson(request).catch(() => null)) as {
      section?: string;
      name?: string;
      bio?: string | null;
      image?: string | null;
      bannerKey?: string | null;
      email?: string;
      theme?: ThemePreference;
      preferredLanguage?: string;
      isNsfw?: boolean;
      showNsfw?: boolean;
      allowDms?: AllowDms;
      notifyComments?: boolean;
      notifyFollows?: boolean;
      notifyChat?: boolean;
      notifyMentions?: boolean;
    } | null;

    if (!body?.section) {
      return await jsonLocalizedError("section is required", 400);
    }

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

    if (body.section === "email") {
      if (typeof body.email !== "string") {
        return await jsonLocalizedError("email is required", 400);
      }
      const result = await updateUserEmail(session.user.id, body.email);
      return NextResponse.json(result);
    }

    if (body.section === "preferences") {
      const settings = await updateUserPreferences({
        userId: session.user.id,
        theme: body.theme,
        preferredLanguage: isLocale(body.preferredLanguage)
          ? body.preferredLanguage
          : undefined,
        isNsfw: body.isNsfw,
        showNsfw: body.showNsfw,
        allowDms: body.allowDms,
        notifyComments: body.notifyComments,
        notifyFollows: body.notifyFollows,
        notifyChat: body.notifyChat,
        notifyMentions: body.notifyMentions,
      });
      return NextResponse.json({ settings });
    }

    return await jsonLocalizedError("Unknown section", 400);
  } catch (error) {
    if (error instanceof AuthError) return await jsonAuthError(error);
    console.error("PATCH /api/me/settings failed", error);
    return await jsonLocalizedError("Failed to save", 500);
  }
}
