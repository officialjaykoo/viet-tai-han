import { getDb } from "@/lib/db";
import { AuthError } from "@/lib/session";
import {
  getUsernameAvailability,
  isUsernameChangeAllowed,
  normalizeUsername,
  toSqliteDate,
  USERNAME_CHANGE_COOLDOWN_DAYS,
  usernameReservedUntil,
  validateUsername,
} from "@/lib/username";
import {
  getUserSettings,
  type UserSettings,
} from "@/lib/user-settings";

export async function changeUsername(input: {
  userId: string;
  username: string;
}): Promise<UserSettings> {
  const validation = validateUsername(input.username);
  if (!validation.ok) {
    throw new AuthError(
      validation.reason === "required"
        ? "Username is required"
        : "Username must be 3–24 letters, numbers, or underscores",
      400
    );
  }

  const db = await getDb();
  const current = await db
    .prepare(
      `SELECT username, usernameChangedAt, onboardingComplete
       FROM "user" WHERE id = ?`
    )
    .bind(input.userId)
    .first<{
      username: string | null;
      usernameChangedAt: string | null;
      onboardingComplete: number;
    }>();
  if (!current) throw new AuthError("User not found", 404);
  if (!current.onboardingComplete) {
    throw new AuthError("Complete onboarding before changing username", 409);
  }

  const currentUsername = current.username
    ? normalizeUsername(current.username)
    : null;
  if (!currentUsername) throw new AuthError("Username is required", 400);
  if (currentUsername === validation.username) {
    const unchanged = await getUserSettings(input.userId);
    if (!unchanged) throw new AuthError("User not found", 404);
    return unchanged;
  }

  if (!isUsernameChangeAllowed(current.usernameChangedAt)) {
    throw new AuthError("Username change is on cooldown", 429);
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

  const changedAt = new Date();
  const changedAtSql = toSqliteDate(changedAt);
  const reservedUntil = usernameReservedUntil(changedAt);
  const historyId = `username_history_${crypto
    .randomUUID()
    .replaceAll("-", "")}`;

  try {
    const results = await db.batch([
      db
        .prepare(
          `INSERT INTO username_history (
             id, userId, username, changedAt, reservedUntil
           )
           SELECT ?, id, username, ?, ?
           FROM "user"
           WHERE id = ?
             AND onboardingComplete = 1
             AND username = ? COLLATE NOCASE
             AND (
               usernameChangedAt IS NULL OR
               datetime(usernameChangedAt, '+' || ? || ' days') <= datetime('now')
             )
             AND NOT EXISTS (
               SELECT 1 FROM "user"
               WHERE username = ? COLLATE NOCASE AND id <> ?
             )
             AND NOT EXISTS (
               SELECT 1 FROM username_history
               WHERE username = ? COLLATE NOCASE
                 AND reservedUntil > datetime('now')
             )`
        )
        .bind(
          historyId,
          changedAtSql,
          reservedUntil,
          input.userId,
          currentUsername,
          String(USERNAME_CHANGE_COOLDOWN_DAYS),
          validation.username,
          input.userId,
          validation.username
        ),
      db
        .prepare(
          `UPDATE "user"
           SET username = ?, usernameChangedAt = ?,
               updatedAt = datetime('now')
           WHERE id = ? AND onboardingComplete = 1
             AND username = ? COLLATE NOCASE
             AND (
               usernameChangedAt IS NULL OR
               datetime(usernameChangedAt, '+' || ? || ' days') <= datetime('now')
             )
             AND NOT EXISTS (
               SELECT 1 FROM "user"
               WHERE username = ? COLLATE NOCASE AND id <> ?
             )
             AND NOT EXISTS (
               SELECT 1 FROM username_history
               WHERE username = ? COLLATE NOCASE
                 AND reservedUntil > datetime('now')
             )`
        )
        .bind(
          validation.username,
          changedAtSql,
          input.userId,
          currentUsername,
          String(USERNAME_CHANGE_COOLDOWN_DAYS),
          validation.username,
          input.userId,
          validation.username
        )
    ]);

    if (Number(results[1]?.meta.changes ?? 0) !== 1) {
      throw new AuthError("Username change could not be completed", 409);
    }
  } catch (error) {
    if (error instanceof AuthError) throw error;
    if (error instanceof Error && /unique/i.test(error.message)) {
      throw new AuthError("Username already in use", 409);
    }
    throw error;
  }

  const updated = await getUserSettings(input.userId);
  if (!updated) throw new AuthError("User not found", 404);
  return updated;
}
