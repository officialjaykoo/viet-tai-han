import { getDb } from "@/lib/db";
import { AuthError } from "@/lib/session";
import { getSiteSetting } from "@/lib/settings";

export type SessionUser = {
  id: string;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  status?: string | null;
  karma?: number | null;
};

export function userKarma(user: SessionUser): number {
  return user.karma ?? 0;
}

export async function requireActiveUser(user: SessionUser) {
  if (user.status === "banned") {
    throw new AuthError("This account can't do that", 403);
  }
  return user;
}

/** Negative karma cannot create posts. */
export async function requireCanCreatePost(user: SessionUser) {
  await requireActiveUser(user);
  if (userKarma(user) < 0) {
    throw new AuthError(
      "Your karma is too low to create posts. Contribute positively first.",
      403
    );
  }
  return user;
}

/** Low / poor karma cannot open DMs. */
export async function requireCanMessage(user: SessionUser) {
  await requireActiveUser(user);
  const min = Number.parseInt(
    await getSiteSetting("min_karma_to_dm", "0"),
    10
  );
  const threshold = Number.isFinite(min) ? min : 0;
  if (userKarma(user) < threshold) {
    throw new AuthError(
      "Your karma is too low to send messages. Participate more first.",
      403
    );
  }
  return user;
}

/** Low / poor karma cannot create communities. */
export async function requireCanCreateCommunity(user: SessionUser) {
  await requireActiveUser(user);
  const min = Number.parseInt(
    await getSiteSetting("min_karma_to_create_community", "5"),
    10
  );
  const threshold = Number.isFinite(min) ? min : 5;
  if (userKarma(user) < threshold) {
    throw new AuthError(
      "Your karma is too low to create a community.",
      403
    );
  }
  return user;
}

export async function requireAdmin(user: SessionUser) {
  await requireActiveUser(user);
  if (user.role !== "admin") {
    throw new AuthError("You don't have permission to do that", 403);
  }
  return user;
}

export async function requireModeratorOrAdmin(
  user: SessionUser,
  subredditId?: string
) {
  await requireActiveUser(user);
  if (user.role === "admin" || user.role === "moderator") {
    return user;
  }
  if (subredditId) {
    const db = await getDb();
    const row = await db
      .prepare(
        `SELECT 1 AS ok FROM subreddit_moderators WHERE subreddit_id = ? AND user_id = ?`
      )
      .bind(subredditId, user.id)
      .first<{ ok: number }>();
    if (row) return user;
  }
  throw new AuthError("You don't have permission to do that", 403);
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function slugifySubreddit(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}
