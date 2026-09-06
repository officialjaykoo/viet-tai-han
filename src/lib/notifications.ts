import { getDb } from "@/lib/db";
import { runBackgroundTask } from "@/lib/background-task";

import { queuePushDelivery } from "@/lib/push";
import {
  decrementUnread,
  getUnreadCounts,
} from "@/lib/unread";
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
export async function canNotifyChat(userId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db
    .prepare(`SELECT notifyChat FROM "user" WHERE id = ?`)
    .bind(userId)
    .first<{ notifyChat: number }>();
  return row ? Boolean(row.notifyChat) : true;
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
  await db.batch([
    db
      .prepare(
        `INSERT INTO notifications (
           id, user_id, actor_id, kind, title, body, href, post_id, comment_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        input.commentId ?? null
      ),
    db
      .prepare(
        `INSERT INTO unread_fanout (user_id, notification_count, updated_at)
         VALUES (?, 1, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
           notification_count = notification_count + 1,
           updated_at = datetime('now')`
      )
      .bind(input.userId),
  ]);
  queuePushDelivery({
    userId: input.userId,
    payload: {
      title: input.title,
      body: input.body,
      href: input.href,
      tag: `notification-${input.kind}`,
    },
  });
  return id;
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
