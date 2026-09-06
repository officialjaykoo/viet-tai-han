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

export async function updateUserProfileAndUsername(input: {
  userId: string;
  username?: string;
  name?: string;
  bio?: string | null;
  image?: string | null;
  bannerKey?: string | null;
}): Promise<UserSettings> {
  console.info(JSON.stringify({ msg: "profile_update_start" }));

  const db = await getDb();
  const current = await getUserSettings(input.userId);
  if (input.name !== undefined && typeof input.name !== "string") {
    throw new AuthError("Display name is invalid", 400);
  }
  if (
    input.bio !== undefined &&
    input.bio !== null &&
    typeof input.bio !== "string"
  ) {
    throw new AuthError("Bio is invalid", 400);
  }
  if (
    input.image !== undefined &&
    input.image !== null &&
    typeof input.image !== "string"
  ) {
    throw new AuthError("Profile image is invalid", 400);
  }

  if (!current) throw new AuthError("User not found", 404);

  const name =
    input.name !== undefined ? input.name.trim().slice(0, 80) : current.name;
  if (!name) throw new AuthError("Display name is required", 400);
  const bio =
    input.bio !== undefined
      ? input.bio?.trim().slice(0, 300) || null
      : current.bio;
  const image = input.image !== undefined ? input.image : current.image;
  const bannerKey =
    input.bannerKey !== undefined ? input.bannerKey : current.bannerKey;

  let nextUsername = current.username;
  let usernameChanged = false;
  let changedAtSql: string | null = null;
  let reservedUntil: string | null = null;
  let historyId: string | null = null;

  if (input.username !== undefined) {
    const validation = validateUsername(input.username);
    if (!validation.ok) {
      throw new AuthError(
        validation.reason === "required"
          ? "Username is required"
          : "Username must be 3–24 letters, numbers, or underscores",
        400
      );
    }

    const currentUsername = current.username
      ? normalizeUsername(current.username)
      : null;
    if (!currentUsername) throw new AuthError("Username is required", 400);
    if (!current.onboardingComplete) {
      throw new AuthError("Complete onboarding before changing username", 409);
    }

    nextUsername = validation.username;
    usernameChanged = currentUsername !== validation.username;

    if (usernameChanged) {
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
      changedAtSql = toSqliteDate(changedAt);
      reservedUntil = usernameReservedUntil(changedAt);
      historyId = `username_history_${crypto
        .randomUUID()
        .replaceAll("-", "")}`;
    }
  }

  const usernameGuards = usernameChanged
    ? ` AND onboardingComplete = 1
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
    : "";

  try {
    const statements = [];
    if (usernameChanged) {
      statements.push(
        db
          .prepare(
            `INSERT INTO username_history (
               id, userId, username, changedAt, reservedUntil
             )
             SELECT ?, id, username, ?, ?
             FROM "user"
             WHERE id = ?${usernameGuards}`
          )
          .bind(
            historyId,
            changedAtSql,
            reservedUntil,
            input.userId,
            current.username,
            String(USERNAME_CHANGE_COOLDOWN_DAYS),
            nextUsername,
            input.userId,
            nextUsername
          )
      );
    }

    statements.push(
      db
        .prepare(
          `UPDATE "user"
           SET username = ?, usernameChangedAt = ?, name = ?, bio = ?,
               image = ?, bannerKey = ?, updatedAt = datetime('now')
           WHERE id = ?${usernameGuards}`
        )
        .bind(
          nextUsername,
          usernameChanged ? changedAtSql : current.usernameChangedAt,
          name,
          bio,
          image,
          bannerKey,
          input.userId,
          ...(usernameChanged
            ? [
                current.username,
                String(USERNAME_CHANGE_COOLDOWN_DAYS),
                nextUsername,
                input.userId,
                nextUsername,
              ]
            : [])
        )
    );

    const results = await db.batch(statements);
    if (
      usernameChanged &&
      (Number(results[0]?.meta.changes ?? 0) !== 1 ||
        Number(results[1]?.meta.changes ?? 0) !== 1)
    ) {
      throw new AuthError("Username change could not be completed", 409);
    }
    if (!usernameChanged && Number(results[0]?.meta.changes ?? 0) !== 1) {
      throw new AuthError("Profile could not be saved", 409);
    }
  } catch (error) {
    if (error instanceof AuthError) throw error;
    if (error instanceof Error && /unique/i.test(error.message)) {
      throw new AuthError("Username already in use", 409);
    }
    throw error;
  }
  console.info(
    JSON.stringify({
      msg: "username_update_done",
      changed: usernameChanged,
    })
  );

  const updated = await getUserSettings(input.userId);
  if (!updated) throw new AuthError("User not found", 404);
  console.info(
    JSON.stringify({
      msg: "profile_update_done",
      usernameChanged,
    })
  );
  return updated;
}

export async function changeUsername(input: {
  userId: string;
  username: string;
}): Promise<UserSettings> {
  return updateUserProfileAndUsername(input);
}
