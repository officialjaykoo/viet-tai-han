import { getDb } from "@/lib/db";
import { AuthError } from "@/lib/session";

export type SessionUser = {
  id: string;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  status?: string | null;
  karma?: number | null;
};

export async function requireActiveUser(user: SessionUser) {
  if (user.status === "banned") {
    throw new AuthError("This account can't do that", 403);
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
