import { getDb } from "@/lib/db";
import { AuthError } from "@/lib/session";

export async function recountSubscribers(subredditId: string): Promise<number> {
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS c FROM subscriptions WHERE subreddit_id = ?`
    )
    .bind(subredditId)
    .first<{ c: number }>();
  const count = row?.c ?? 0;
  await db
    .prepare(
      `UPDATE subreddits SET subscriber_count = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .bind(count, subredditId)
    .run();
  return count;
}

export async function isSubscribed(userId: string, subredditId: string) {
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT 1 AS ok FROM subscriptions WHERE user_id = ? AND subreddit_id = ?`
    )
    .bind(userId, subredditId)
    .first();
  return Boolean(row);
}

export async function subscribeToSubreddit(userId: string, subredditId: string) {
  const db = await getDb();
  const sub = await db
    .prepare(`SELECT id FROM subreddits WHERE id = ? AND is_removed = 0`)
    .bind(subredditId)
    .first();
  if (!sub) throw new AuthError("Community not found", 404);

  if (await isSubscribed(userId, subredditId)) {
    const count = await recountSubscribers(subredditId);
    return { subscribed: true, subscriberCount: count };
  }

  await db
    .prepare(
      `INSERT INTO subscriptions (user_id, subreddit_id) VALUES (?, ?)`
    )
    .bind(userId, subredditId)
    .run();

  const count = await recountSubscribers(subredditId);
  return { subscribed: true, subscriberCount: count };
}

export async function unsubscribeFromSubreddit(
  userId: string,
  subredditId: string
) {
  const db = await getDb();
  await db
    .prepare(
      `DELETE FROM subscriptions WHERE user_id = ? AND subreddit_id = ?`
    )
    .bind(userId, subredditId)
    .run();
  const count = await recountSubscribers(subredditId);
  return { subscribed: false, subscriberCount: count };
}
