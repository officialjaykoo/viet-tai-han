import { getDb } from "@/lib/db";

export type UnreadCounts = {
  notificationCount: number;
  messageCount: number;
  totalCount: number;
};

type UnreadCounter = "notifications" | "messages";

function counterColumn(counter: UnreadCounter):
  | "notification_count"
  | "message_count" {
  return counter === "notifications" ? "notification_count" : "message_count";
}

export async function ensureUnreadFanout(userId: string) {
  const db = await getDb();
  await db
    .prepare(
      `INSERT OR IGNORE INTO unread_fanout (
         user_id, notification_count, message_count
       ) VALUES (
         ?,
         (SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0),
         (
           SELECT COUNT(*)
           FROM chat_messages cm
           INNER JOIN chat_room_members rm
             ON rm.room_id = cm.room_id AND rm.user_id = ?
           WHERE rm.membership_status = 'active'
             AND cm.sender_id != ?
             AND cm.delivery_status = 'delivered'
             AND cm.is_shadow_hidden = 0
             AND cm.is_moderation_hidden = 0
             AND (
               rm.last_read_at IS NULL
               OR cm.created_at > rm.last_read_at
             )
         )
       )`
    )
    .bind(userId, userId, userId, userId)
    .run();
}

export async function incrementUnread(
  userId: string,
  counter: UnreadCounter,
  amount = 1
) {
  if (!Number.isInteger(amount) || amount <= 0) return;
  const db = await getDb();
  const column = counterColumn(counter);
  await db
    .prepare(
      `INSERT INTO unread_fanout (user_id, ${column}, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         ${column} = ${column} + excluded.${column},
         updated_at = datetime('now')`
    )
    .bind(userId, amount)
    .run();
}

export async function decrementUnread(
  userId: string,
  counter: UnreadCounter,
  amount = 1
) {
  if (!Number.isInteger(amount) || amount <= 0) return;
  const db = await getDb();
  const column = counterColumn(counter);
  await db
    .prepare(
      `UPDATE unread_fanout
       SET ${column} = MAX(0, ${column} - ?), updated_at = datetime('now')
       WHERE user_id = ?`
    )
    .bind(amount, userId)
    .run();
}

export async function refreshUnreadCounts(userId: string) {
  await ensureUnreadFanout(userId);
  const db = await getDb();
  await db
    .prepare(
      `UPDATE unread_fanout
       SET
         notification_count = (
           SELECT COUNT(*)
           FROM notifications
           WHERE user_id = unread_fanout.user_id AND is_read = 0
         ),
         message_count = (
           SELECT COUNT(*)
           FROM chat_messages cm
           INNER JOIN chat_room_members rm
             ON rm.room_id = cm.room_id AND rm.user_id = unread_fanout.user_id
           WHERE rm.membership_status = 'active'
             AND cm.sender_id != unread_fanout.user_id
             AND cm.delivery_status = 'delivered'
             AND cm.is_shadow_hidden = 0
             AND cm.is_moderation_hidden = 0
             AND (
               rm.last_read_at IS NULL
               OR cm.created_at > rm.last_read_at
             )
         ),
         updated_at = datetime('now')
       WHERE user_id = ?`
    )
    .bind(userId)
    .run();
}

export async function getUnreadCounts(userId: string): Promise<UnreadCounts> {
  await ensureUnreadFanout(userId);
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT notification_count, message_count
       FROM unread_fanout
       WHERE user_id = ?`
    )
    .bind(userId)
    .first<{ notification_count: number; message_count: number }>();
  const notificationCount = Number(row?.notification_count ?? 0);
  const messageCount = Number(row?.message_count ?? 0);
  return {
    notificationCount,
    messageCount,
    totalCount: notificationCount + messageCount,
  };
}
