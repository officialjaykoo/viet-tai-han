import { getDb } from "@/lib/db";
import type { FriendState } from "@/lib/friends";
import type { RelationshipProjection } from "@/lib/user-actions";

export const ONLINE_WINDOW_MINUTES = 5;

export type OnlineUser = {
  id: string;
  username: string;
  name: string;
  image: string | null;
  lastSeenAt: string;
  relationship: RelationshipProjection;
};

type OnlineUserRow = {
  id: string;
  username: string;
  name: string;
  image: string | null;
  last_seen_at: string;
  follow_state: string;
  friend_state: string;
  friend_request_id: string | null;
  can_message: number;
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
  const relationshipJoins = hasViewer
    ? `
       LEFT JOIN user_friendships f
         ON (
           (f.requester_id = ? AND f.addressee_id = u.id)
           OR (f.addressee_id = ? AND f.requester_id = u.id)
         )
       LEFT JOIN user_follows follow
         ON follow.follower_id = ? AND follow.following_id = u.id
       LEFT JOIN user_follows reverse_follow
         ON reverse_follow.follower_id = u.id AND reverse_follow.following_id = ?`
    : "";
  const order = hasViewer
    ? "ORDER BY CASE WHEN f.status = 'accepted' THEN 0 ELSE 1 END, p.last_seen_at DESC, u.username ASC"
    : "ORDER BY p.last_seen_at DESC, u.username ASC";
  const bindings: Array<string | number> = [];
  if (hasViewer) {
    bindings.push(
      viewerUserId!,
      viewerUserId!,
      viewerUserId!,
      viewerUserId!,
      viewerUserId!,
      viewerUserId!,
      viewerUserId!,
      viewerUserId!,
      viewerUserId!
    );
  }
  bindings.push(safeLimit);
  const followStateSelect = hasViewer
    ? "CASE WHEN follow.follower_id IS NOT NULL THEN 'following' ELSE 'none' END AS follow_state"
    : "'none' AS follow_state";
  const friendStateSelect = hasViewer
    ? `CASE
         WHEN f.status = 'accepted' THEN 'friends'
         WHEN f.status = 'pending' AND f.requester_id = ? THEN 'outgoing_pending'
         WHEN f.status = 'pending' AND f.addressee_id = ? THEN 'incoming_pending'
         ELSE 'none'
       END AS friend_state`
    : "'none' AS friend_state";
  const friendRequestSelect = hasViewer
    ? "CASE WHEN f.status = 'pending' THEN f.id ELSE NULL END AS friend_request_id"
    : "NULL AS friend_request_id";
  const canMessageSelect = hasViewer
    ? `CASE
         WHEN f.status = 'accepted'
           OR reverse_follow.follower_id IS NOT NULL
           OR u.allowDms = 'anyone'
           OR (u.allowDms = 'followers' AND follow.follower_id IS NOT NULL)
         THEN 1 ELSE 0
       END AS can_message`
    : "0 AS can_message";


  const { results } = await db
    .prepare(
      `SELECT u.id, u.username, u.name, u.image, p.last_seen_at,
              ${followStateSelect},
              ${friendStateSelect},
              ${friendRequestSelect},
              ${canMessageSelect}
       FROM user_presence p
       INNER JOIN "user" u ON u.id = p.user_id
       ${relationshipJoins}
       WHERE u.status = 'active'
         AND u.username IS NOT NULL
         AND p.last_seen_at >= datetime('now', '-${ONLINE_WINDOW_MINUTES} minutes')
         ${viewerFilters}
       ${order}
       LIMIT ?`
    )
    .bind(...bindings)
    .all<OnlineUserRow>();

  return (results ?? []).map((row) => {
    const friendState: FriendState =
      row.friend_state === "outgoing_pending" ||
      row.friend_state === "incoming_pending" ||
      row.friend_state === "friends"
        ? row.friend_state
        : "none";
    const canInteract = Boolean(viewerUserId);
    return {
      id: row.id,
      username: row.username,
      name: row.name,
      image: row.image,
      lastSeenAt: row.last_seen_at,
      relationship: {
        followState: row.follow_state === "following" ? "following" : "none",
        friendState,
        friendRequestId: row.friend_request_id,
        blockState: "none",
        canViewProfile: true,
        canInteract,
        canMessage: canInteract && Boolean(row.can_message),
        isSelf: false,
      },
    };
  });
}
