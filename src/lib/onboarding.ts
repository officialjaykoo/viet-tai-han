import { getDb } from "@/lib/db";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { AuthError } from "@/lib/session";
import {
  getUsernameAvailability,
  validateUsername,
  normalizeDisplayName,
} from "@/lib/username";
import { getUserSettings, type UserSettings } from "@/lib/user-settings";

export type OnboardingState = Pick<
  UserSettings,
  | "id"
  | "name"
  | "username"
  | "onboardingUsernameCandidate"
  | "preferredLanguage"
  | "onboardingComplete"
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
    onboardingUsernameCandidate: settings.onboardingUsernameCandidate,
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
  const name = normalizeDisplayName(input.name);
  if (!input.name.trim()) {
    throw new AuthError("Display name is required", 400);
  }

  const validation = validateUsername(input.username);
  if (!validation.ok) {
    throw new AuthError(
      validation.reason === "required"
        ? "Username is required"
        : "Username must be 3–24 letters, numbers, or underscores",
      400
    );
  }
  if (!isLocale(input.preferredLanguage)) {
    throw new AuthError("Onboarding language is required", 400);
  }

  const db = await getDb();
  const current = await getOnboardingState(input.userId);
  if (!current) throw new AuthError("User not found", 404);
  if (current.onboardingComplete) {
    throw new AuthError("Onboarding already complete", 409);
  }

  const availability = await getUsernameAvailability(db, validation.username, {
    excludeUserId: input.userId,
  });
  if (availability === "taken") {
    throw new AuthError("Username already in use", 409);
  }
  if (availability === "reserved") {
    throw new AuthError("Username is reserved", 409);
  }

  try {
    await db
      .prepare(
        `UPDATE "user"
         SET name = ?, username = ?,
             onboardingUsernameCandidate = NULL,
             usernameChangedAt = NULL,
             preferredLanguage = ?, onboardingComplete = 1,
             updatedAt = datetime('now')
         WHERE id = ? AND onboardingComplete = 0`
      )
      .bind(
        name,
        validation.username,
        input.preferredLanguage as Locale,
        input.userId
      )
      .run();
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) {
      throw new AuthError("Username already in use", 409);
    }
    throw error;
  }

  const updated = await getOnboardingState(input.userId);
  if (!updated) throw new AuthError("User not found", 404);
  if (!updated.onboardingComplete) {
    throw new AuthError("Onboarding could not be completed", 409);
  }
  return updated;
}
