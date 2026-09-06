import { getDb } from "@/lib/db";
import type { Locale } from "@/lib/i18n/config";
import { isLocale } from "@/lib/i18n/config";
import { normalizeAvatarImage } from "@/lib/avatar";
import { AuthError } from "@/lib/session";
export type ThemePreference = "system" | "light" | "dark";
export type AllowDms = "anyone" | "followers" | "nobody";

export type UserSettings = {
  id: string;
  username: string | null;
  onboardingUsernameCandidate: string | null;
  usernameChangedAt: string | null;
  name: string;
  contactEmail: string | null;
  contactEmailVerified: boolean;
  onboardingComplete: boolean;
  image: string | null;
  bio: string | null;
  bannerKey: string | null;
  preferredLanguage: string;
  theme: ThemePreference;
  isNsfw: boolean;
  showNsfw: boolean;
  allowDms: AllowDms;
  notifyComments: boolean;
  notifyFollows: boolean;
  notifyChat: boolean;
  notifyMentions: boolean;
};

function isTheme(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isAllowDms(value: unknown): value is AllowDms {
  return value === "anyone" || value === "followers" || value === "nobody";
}

export async function getUserSettings(
  userId: string
): Promise<UserSettings | null> {
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT id, username, onboardingUsernameCandidate, usernameChangedAt,
              name, contactEmail, contactEmailVerified, onboardingComplete,
              image, bio, bannerKey, preferredLanguage, theme, isNsfw,
              showNsfw, allowDms, notifyComments, notifyFollows, notifyChat,
              notifyMentions
       FROM "user" WHERE id = ?`
    )
    .bind(userId)
    .first<{
      id: string;
      username: string | null;
      onboardingUsernameCandidate: string | null;
      usernameChangedAt: string | null;
      name: string;
      contactEmail: string | null;
      contactEmailVerified: number;
      onboardingComplete: number;
      image: string | null;
      bio: string | null;
      bannerKey: string | null;
      preferredLanguage: string;
      theme: string;
      isNsfw: number;
      showNsfw: number;
      allowDms: string;
      notifyComments: number;
      notifyFollows: number;
      notifyChat: number;
      notifyMentions: number;
    }>();

  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    onboardingUsernameCandidate: row.onboardingUsernameCandidate,
    usernameChangedAt: row.usernameChangedAt,
    name: row.name,
    contactEmail: row.contactEmail,
    contactEmailVerified: Boolean(row.contactEmailVerified),
    onboardingComplete: Boolean(row.onboardingComplete),
    image: row.image,
    bio: row.bio,
    bannerKey: row.bannerKey,
    preferredLanguage: row.preferredLanguage,
    theme: isTheme(row.theme) ? row.theme : "system",
    isNsfw: Boolean(row.isNsfw),
    showNsfw: Boolean(row.showNsfw),
    allowDms: isAllowDms(row.allowDms) ? row.allowDms : "anyone",
    notifyComments: Boolean(row.notifyComments),
    notifyFollows: Boolean(row.notifyFollows),
    notifyChat: Boolean(row.notifyChat),
    notifyMentions: Boolean(row.notifyMentions),
  };
}

export async function updateUserContactEmail(
  userId: string,
  contactEmail: string
) {
  const normalized = contactEmail.trim().toLowerCase();
  if (normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new AuthError("Invalid contact email", 400);
  }

  const db = await getDb();
  await db
    .prepare(
      `UPDATE "user"
       SET contactEmail = ?, contactEmailVerified = 0,
           updatedAt = datetime('now')
       WHERE id = ?`
    )
    .bind(normalized || null, userId)
    .run();

  return {
    contactEmail: normalized || null,
    contactEmailVerified: false,
  };
}


export async function updateUserProfile(input: {
  userId: string;
  name?: string;
  bio?: string | null;
  image?: string | null;
  bannerKey?: string | null;
}) {
  const db = await getDb();
  const current = await getUserSettings(input.userId);
  if (!current) throw new AuthError("User not found", 404);

  const name =
    input.name !== undefined ? input.name.trim().slice(0, 80) : current.name;
  if (!name) throw new AuthError("Display name is required", 400);

  const bio =
    input.bio !== undefined
      ? input.bio?.trim().slice(0, 300) || null
      : current.bio;
  const image =
    input.image !== undefined
      ? normalizeAvatarImage(input.image)
      : current.image;
  const bannerKey =
    input.bannerKey !== undefined ? input.bannerKey : current.bannerKey;

  await db
    .prepare(
      `UPDATE "user"
       SET name = ?, bio = ?, image = ?, bannerKey = ?, updatedAt = datetime('now')
       WHERE id = ?`
    )
    .bind(name, bio, image, bannerKey, input.userId)
    .run();

  return getUserSettings(input.userId);
}

export async function updateUserPreferences(input: {
  userId: string;
  theme?: ThemePreference;
  preferredLanguage?: Locale;
  isNsfw?: boolean;
  showNsfw?: boolean;
  allowDms?: AllowDms;
  notifyComments?: boolean;
  notifyFollows?: boolean;
  notifyChat?: boolean;
  notifyMentions?: boolean;
}) {
  const db = await getDb();
  const current = await getUserSettings(input.userId);
  if (!current) throw new AuthError("User not found", 404);

  if (input.theme !== undefined && !isTheme(input.theme)) {
    throw new AuthError("Invalid theme", 400);
  }
  if (
    input.preferredLanguage !== undefined &&
    !isLocale(input.preferredLanguage)
  ) {
    throw new AuthError("Invalid language", 400);
  }
  if (input.allowDms !== undefined && !isAllowDms(input.allowDms)) {
    throw new AuthError("Invalid DM preference", 400);
  }

  const theme = input.theme ?? current.theme;
  const preferredLanguage =
    input.preferredLanguage ?? current.preferredLanguage;
  const isNsfw =
    input.isNsfw !== undefined ? (input.isNsfw ? 1 : 0) : current.isNsfw ? 1 : 0;
  const showNsfw =
    input.showNsfw !== undefined
      ? input.showNsfw
        ? 1
        : 0
      : current.showNsfw
        ? 1
        : 0;
  const allowDms = input.allowDms ?? current.allowDms;
  const notifyComments =
    input.notifyComments !== undefined
      ? input.notifyComments
        ? 1
        : 0
      : current.notifyComments
        ? 1
        : 0;
  const notifyFollows =
    input.notifyFollows !== undefined
      ? input.notifyFollows
        ? 1
        : 0
      : current.notifyFollows
        ? 1
        : 0;
  const notifyChat =
    input.notifyChat !== undefined
      ? input.notifyChat
        ? 1
        : 0
      : current.notifyChat
        ? 1
        : 0;
  const notifyMentions =
    input.notifyMentions !== undefined
      ? input.notifyMentions
        ? 1
        : 0
      : current.notifyMentions
        ? 1
        : 0;

  await db
    .prepare(
      `UPDATE "user"
       SET theme = ?, preferredLanguage = ?, isNsfw = ?, showNsfw = ?,
           allowDms = ?, notifyComments = ?, notifyFollows = ?,
           notifyChat = ?, notifyMentions = ?, updatedAt = datetime('now')
       WHERE id = ?`
    )
    .bind(
      theme,
      preferredLanguage,
      isNsfw,
      showNsfw,
      allowDms,
      notifyComments,
      notifyFollows,
      notifyChat,
      notifyMentions,
      input.userId
    )
    .run();

  return getUserSettings(input.userId);
}


export async function listBlockedUsers(userId: string) {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT u.id, u.username, u.name, u.image, b.created_at
       FROM user_blocks b
       INNER JOIN "user" u ON u.id = b.blocked_id
       WHERE b.blocker_id = ?
       ORDER BY b.created_at DESC
       LIMIT 100`
    )
    .bind(userId)
    .all<{
      id: string;
      username: string | null;
      name: string;
      image: string | null;
      created_at: string;
    }>();

  return (results ?? []).map((row) => ({
    id: row.id,
    username: row.username,
    name: row.name,
    image: row.image,
    blockedAt: row.created_at,
  }));
}

/** Whether recipient accepts a new chat request from sender. */
export async function canReceiveChatRequest(input: {
  fromUserId: string;
  toUserId: string;
}): Promise<boolean> {
  const { getDmRelationship } = await import("@/lib/dm-relationships");
  const relationship = await getDmRelationship({
    senderId: input.fromUserId,
    recipientId: input.toUserId,
  });
  return relationship.requestAllowed;
}
