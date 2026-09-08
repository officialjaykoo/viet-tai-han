import { formatUserHandle } from "@/lib/profile-url";
import { getDb } from "@/lib/db";
import { recountSubscribers } from "@/lib/communities";
import { profileCommunityName } from "@/lib/profile-community-name";
import { AuthError } from "@/lib/session";

export {
  isProfileCommunityName,
  parseProfileCommunityName,
  profileCommunityName,
} from "@/lib/profile-community-name";

/** Find or create the caller's personal community used for profile posts. */
export async function ensureProfileCommunity(input: {
  userId: string;
  username: string;
}): Promise<{ id: string; name: string }> {
  let name: string;
  try {
    name = profileCommunityName(input.username);
  } catch {
    throw new AuthError("Invalid username for profile posts", 400);
  }

  const db = await getDb();
  const existing = await db
    .prepare(
      `SELECT id, name, created_by
       FROM subreddits WHERE name = ? COLLATE NOCASE AND is_removed = 0`
    )
    .bind(name)
    .first<{ id: string; name: string; created_by: string | null }>();

  if (!existing) {
    const id = crypto.randomUUID();
    const title = formatUserHandle(input.username);
    await db
      .prepare(
        `INSERT OR IGNORE INTO subreddits (
           id, name, title, description, created_by, subscriber_count
         ) VALUES (?, ?, ?, ?, ?, 0)`
      )
      .bind(
        id,
        name,
        title,
        "Personal profile posts",
        input.userId
      )
      .run();
  }

  const resolved = await db
    .prepare(
      `SELECT id, name, created_by
       FROM subreddits WHERE name = ? COLLATE NOCASE AND is_removed = 0`
    )
    .bind(name)
    .first<{ id: string; name: string; created_by: string | null }>();

  if (!resolved) {
    throw new AuthError("Could not initialize profile community", 500);
  }
  if (resolved.created_by !== input.userId) {
    throw new AuthError("Profile community belongs to another user", 403);
  }

  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO subscriptions (user_id, subreddit_id)
         VALUES (?, ?)`
      )
      .bind(input.userId, resolved.id),
    db
      .prepare(
        `INSERT OR IGNORE INTO subreddit_moderators (subreddit_id, user_id)
         VALUES (?, ?)`
      )
      .bind(resolved.id, input.userId),
  ]);
  await recountSubscribers(resolved.id);

  return { id: resolved.id, name: resolved.name };
}
