import { getDb } from "@/lib/db";

export const ONLINE_WINDOW_MINUTES = 5;

export type OnlineUser = {
  id: string;
  username: string;
  name: string;
  image: string | null;
  lastSeenAt: string;
};

type OnlineUserRow = {
  id: string;
  username: string;
  name: string;
  image: string | null;
  last_seen_at: string;
};

export async function touchUserPresence(userId: string): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO user_presence (user_id, last_seen_at)
       VALUES (?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`
    )
    .bind(userId)
    .run();
}

export async function listOnlineUsers(
  viewerUserId?: string | null,
  limit = 12
): Promise<OnlineUser[]> {
  const db = await getDb();
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 30));
  const hasViewer = Boolean(viewerUserId);
  const viewerFilters = hasViewer
    ? `
         AND u.id != ?
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks b
           WHERE b.blocker_id = ? AND b.blocked_id = u.id
         )
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks b
           WHERE b.blocker_id = u.id AND b.blocked_id = ?
         )`
    : "";
  const friendJoin = hasViewer
    ? `
       LEFT JOIN user_friendships f
         ON f.status = 'accepted'
        AND (
          (f.requester_id = ? AND f.addressee_id = u.id)
          OR (f.addressee_id = ? AND f.requester_id = u.id)
        )`
    : "";
  const order = hasViewer
    ? "ORDER BY CASE WHEN f.id IS NULL THEN 1 ELSE 0 END, p.last_seen_at DESC, u.username ASC"
    : "ORDER BY p.last_seen_at DESC, u.username ASC";
  const bindings: Array<string | number> = [];
  if (hasViewer) {
    bindings.push(
      viewerUserId!,
      viewerUserId!,
      viewerUserId!,
      viewerUserId!,
      viewerUserId!
    );
  }
  bindings.push(safeLimit);

  const { results } = await db
    .prepare(
      `SELECT u.id, u.username, u.name, u.image, p.last_seen_at
       FROM user_presence p
       INNER JOIN "user" u ON u.id = p.user_id
       ${friendJoin}
       WHERE u.status = 'active'
         AND u.username IS NOT NULL
         AND p.last_seen_at >= datetime('now', '-${ONLINE_WINDOW_MINUTES} minutes')
         ${viewerFilters}
       ${order}
       LIMIT ?`
    )
    .bind(...bindings)
    .all<OnlineUserRow>();

  return (results ?? []).map((row) => ({
    id: row.id,
    username: row.username,
    name: row.name,
    image: row.image,
    lastSeenAt: row.last_seen_at,
  }));
}
