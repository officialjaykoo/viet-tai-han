import { getDb } from "@/lib/db";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { AuthError } from "@/lib/session";
import { getUserSettings, type UserSettings } from "@/lib/user-settings";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 24;

export type OnboardingState = Pick<
  UserSettings,
  "id" | "name" | "username" | "preferredLanguage" | "onboardingComplete"
>;

export async function getOnboardingState(
  userId: string
): Promise<OnboardingState | null> {
  const settings = await getUserSettings(userId);
  if (!settings) return null;

  return {
    id: settings.id,
    name: settings.name,
    username: settings.username,
    preferredLanguage: settings.preferredLanguage,
    onboardingComplete: settings.onboardingComplete,
  };
}

export async function completeOnboarding(input: {
  userId: string;
  name: string;
  username: string;
  preferredLanguage: string;
}): Promise<OnboardingState> {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new AuthError("Display name is required", 400);

  const username = input.username.trim().toLowerCase();
  if (!username) throw new AuthError("Username is required", 400);
  if (
    username.length < MIN_USERNAME_LENGTH ||
    username.length > MAX_USERNAME_LENGTH ||
    !USERNAME_PATTERN.test(username)
  ) {
    throw new AuthError(
      "Username must be 3–24 letters, numbers, or underscores",
      400
    );
  }
  if (!isLocale(input.preferredLanguage)) {
    throw new AuthError("Onboarding language is required", 400);
  }

  const db = await getDb();
  const current = await getOnboardingState(input.userId);
  if (!current) throw new AuthError("User not found", 404);

  const taken = await db
    .prepare(
      `SELECT id FROM "user"
       WHERE username = ? COLLATE NOCASE AND id <> ?`
    )
    .bind(username, input.userId)
    .first<{ id: string }>();
  if (taken) throw new AuthError("Username already in use", 409);

  try {
    await db
      .prepare(
        `UPDATE "user"
         SET name = ?, username = ?, displayUsername = ?,
             preferredLanguage = ?, onboardingComplete = 1,
             updatedAt = datetime('now')
         WHERE id = ?`
      )
      .bind(name, username, username, input.preferredLanguage as Locale, input.userId)
      .run();
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) {
      throw new AuthError("Username already in use", 409);
    }
    throw error;
  }

  return {
    id: input.userId,
    name,
    username,
    preferredLanguage: input.preferredLanguage,
    onboardingComplete: true,
  };
}
