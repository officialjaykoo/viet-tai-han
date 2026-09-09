import { getDb } from "@/lib/db";
import { runBackgroundTask } from "@/lib/background-task";

import { queuePushDelivery } from "@/lib/push";
import { decrementUnread, getUnreadCounts } from "@/lib/unread";
import { AuthError } from "@/lib/session";

export type NotificationKind =
  | "comment_on_post"
  | "reply_to_comment"
  | "follow"
  | "friend_request"
  | "friend_accepted"
  | "chat_request"
  | "chat_accepted"
  | "warning"
  | "mention";

const BLOCK_GUARDED_NOTIFICATION_KINDS: ReadonlySet<NotificationKind> = new Set([
  "comment_on_post",
  "reply_to_comment",
  "mention",
  "follow",
  "friend_request",
  "friend_accepted",
  "chat_request",
  "chat_accepted",
]);
export async function canNotifyChat(
  userId: string,
  actorId?: string | null
): Promise<boolean> {
  const db = await getDb();
  const row = await db
    .prepare(`SELECT notifyChat FROM "user" WHERE id = ?`)
    .bind(userId)
    .first<{ notifyChat: number }>();
  if (row && !row.notifyChat) return false;
  if (!actorId) return true;

  const blocked = await db
    .prepare(
      `SELECT 1 AS blocked
       FROM user_blocks
       WHERE (blocker_id = ? AND blocked_id = ?)
          OR (blocker_id = ? AND blocked_id = ?)
       LIMIT 1`
    )
    .bind(userId, actorId, actorId, userId)
    .first();
  return !blocked;
}

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  href: string | null;
  isRead: boolean;
  createdAt: string;
  actor: {
    username: string | null;
    displayName: string | null;
    image: string | null;
  } | null;
};

export async function createNotification(input: {
  userId: string;
  actorId?: string | null;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
  postId?: string | null;
  commentId?: string | null;
  sourceRequestId?: string | null;
}) {
  // Never notify yourself
  if (input.actorId && input.actorId === input.userId) return null;

  const db = await getDb();
  const prefs = await db
    .prepare(
      `SELECT notifyComments, notifyFollows, notifyChat, notifyMentions
       FROM "user" WHERE id = ?`
    )
    .bind(input.userId)
    .first<{
      notifyComments: number;
      notifyFollows: number;
      notifyChat: number;
      notifyMentions: number;
    }>();

  if (prefs) {
    if (
      (input.kind === "comment_on_post" || input.kind === "reply_to_comment") &&
      !prefs.notifyComments
    ) {
      return null;
    }
    if (
      (input.kind === "follow" ||
        input.kind === "friend_request" ||
        input.kind === "friend_accepted") &&
      !prefs.notifyFollows
    ) {
      return null;
    }
    if (
      (input.kind === "chat_request" || input.kind === "chat_accepted") &&
      !prefs.notifyChat
    ) {
      return null;
    }
    if (input.kind === "mention" && !prefs.notifyMentions) return null;
  }

  const id = crypto.randomUUID();
  const blockGuarded = Boolean(
    input.actorId &&
      BLOCK_GUARDED_NOTIFICATION_KINDS.has(input.kind)
  );
  const requestGuarded =
    input.kind === "friend_request" || input.kind === "chat_request";
  const [notificationInsert] = await db.batch([
    db
      .prepare(
        `INSERT INTO notifications (
           id, user_id, actor_id, kind, title, body, href, post_id, comment_id,
           source_request_id
         )
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE (
           ? = 0
           OR (
             NOT EXISTS (
               SELECT 1 FROM user_blocks
               WHERE (blocker_id = ? AND blocked_id = ?)
                  OR (blocker_id = ? AND blocked_id = ?)
             )
             AND (
               ? = 0
               OR (
                 (
                   ? = 'friend_request'
                   AND EXISTS (
                     SELECT 1 FROM user_friendships
                     WHERE id = ?
                       AND requester_id = ?
                       AND addressee_id = ?
                       AND status = 'pending'
                   )
                 )
                 OR (
                   ? = 'chat_request'
                   AND EXISTS (
                     SELECT 1 FROM chat_requests
                     WHERE id = ?
                       AND from_user_id = ?
                       AND to_user_id = ?
                       AND status = 'pending'
                   )
                 )
               )
             )
           )
         )`
      )
      .bind(
        id,
        input.userId,
        input.actorId ?? null,
        input.kind,
        input.title.slice(0, 200),
        input.body?.slice(0, 500) ?? null,
        input.href?.slice(0, 400) ?? null,
        input.postId ?? null,
        input.commentId ?? null,
        input.sourceRequestId ?? null,
        blockGuarded ? 1 : 0,
        input.userId,
        input.actorId ?? null,
        input.actorId ?? null,
        input.userId,
        requestGuarded ? 1 : 0,
        input.kind,
        input.sourceRequestId ?? null,
        input.actorId ?? null,
        input.userId,
        input.kind,
        input.sourceRequestId ?? null,
        input.actorId ?? null,
        input.userId
      ),
    db
      .prepare(
        `INSERT INTO unread_fanout (user_id, notification_count, updated_at)
         SELECT ?, 1, datetime('now')
         WHERE EXISTS (
           SELECT 1 FROM notifications
           WHERE id = ? AND user_id = ?
         )
           AND (
             ? = 0
             OR NOT EXISTS (
               SELECT 1 FROM user_blocks
               WHERE (blocker_id = ? AND blocked_id = ?)
                  OR (blocker_id = ? AND blocked_id = ?)
             )
           )
         ON CONFLICT(user_id) DO UPDATE SET
           notification_count = notification_count + 1,
           updated_at = datetime('now')`
      )
      .bind(
        input.userId,
        id,
        input.userId,
        blockGuarded ? 1 : 0,
        input.userId,
        input.actorId ?? null,
        input.actorId ?? null,
        input.userId
      ),
  ]);
  if (Number(notificationInsert?.meta.changes ?? 0) !== 1) return null;
  queuePushDelivery({
    userId: input.userId,
    blockedActorId: blockGuarded ? input.actorId : null,
    payload: {
      title: input.title,
      body: input.body,
      href: input.href,
      tag: `notification-${input.kind}`,
    },
  });
  return id;
}

export function actionableNotificationReadStatements(
  db: D1Database,
  input: {
    recipientId: string;
    actorId: string;
    kind: "friend_request" | "chat_request";
    sourceRequestId: string;
  }
) {
  return [
    db
      .prepare(
        `UPDATE notifications
         SET is_read = 1
         WHERE user_id = ?
           AND actor_id = ?
           AND kind = ?
           AND is_read = 0
           AND (source_request_id = ? OR source_request_id IS NULL)`
      )
      .bind(
        input.recipientId,
        input.actorId,
        input.kind,
        input.sourceRequestId
      ),
    db
      .prepare(
        `INSERT INTO unread_fanout (user_id, notification_count, updated_at)
         VALUES (
           ?,
           (
             SELECT COUNT(*)
             FROM notifications
             WHERE user_id = ? AND is_read = 0
           ),
           datetime('now')
         )
         ON CONFLICT(user_id) DO UPDATE SET
           notification_count = excluded.notification_count,
           updated_at = excluded.updated_at`
      )
      .bind(input.recipientId, input.recipientId),
  ];
}

export async function reconcileActionableNotification(input: {
  recipientId: string;
  actorId: string;
  kind: "friend_request" | "chat_request";
  sourceRequestId: string;
}) {
  const db = await getDb();
  const [result] = await db.batch(
    actionableNotificationReadStatements(db, input)
  );
  return Number(result?.meta.changes ?? 0);
}

export async function listNotifications(
  userId: string,
  options: { limit?: number; unreadOnly?: boolean } = {}
): Promise<NotificationItem[]> {
  const db = await getDb();
  const limit = Math.min(Math.max(options.limit ?? 40, 1), 100);
  const unreadClause = options.unreadOnly ? `AND n.is_read = 0` : "";

  const { results } = await db
    .prepare(
      `SELECT
         n.id, n.kind, n.title, n.body, n.href, n.is_read, n.created_at,
         u.username AS actor_username,
         u.name AS actor_display_name,
         u.image AS actor_image
       FROM notifications n
       LEFT JOIN "user" u ON u.id = n.actor_id
       WHERE n.user_id = ? ${unreadClause}
       ORDER BY n.created_at DESC
       LIMIT ?`
    )
    .bind(userId, limit)
    .all<{
      id: string;
      kind: NotificationKind;
      title: string;
      body: string | null;
      href: string | null;
      is_read: number;
      created_at: string;
      actor_username: string | null;
      actor_display_name: string | null;
      actor_image: string | null;
    }>();

  return (results ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    actor: row.actor_username
      ? {
          username: row.actor_username,
          displayName: row.actor_display_name,
          image: row.actor_image,
        }
      : row.actor_display_name
        ? {
            username: null,
            displayName: row.actor_display_name,
            image: row.actor_image,
          }
        : null,
  }));
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const counts = await getUnreadCounts(userId);
  return counts.notificationCount;
}

export async function markNotificationsRead(input: {
  userId: string;
  ids?: string[];
  all?: boolean;
}) {
  const db = await getDb();
  if (input.all) {
    const result = await db
      .prepare(
        `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`
      )
      .bind(input.userId)
      .run();
    if (result.meta.changes) {
      await decrementUnread(
        input.userId,
        "notifications",
        result.meta.changes
      );
    }
    return { ok: true };
  }
  if (!input.ids?.length) {
    throw new AuthError("Nothing to mark read", 400);
  }
  const placeholders = input.ids.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `UPDATE notifications
       SET is_read = 1
       WHERE user_id = ? AND id IN (${placeholders}) AND is_read = 0`
    )
    .bind(input.userId, ...input.ids)
    .run();
  if (result.meta.changes) {
    await decrementUnread(
      input.userId,
      "notifications",
      result.meta.changes
    );
  }
  return { ok: true };
}

/** Best-effort notify with Worker lifecycle completion tracking. */
export function notifyQuietly(
  input: Parameters<typeof createNotification>[0]
) {
  runBackgroundTask("notification", () => createNotification(input));
}
