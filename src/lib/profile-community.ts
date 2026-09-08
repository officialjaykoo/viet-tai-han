import { formatUserHandle } from "@/lib/profile-url";
import { getDb } from "@/lib/db";
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

  if (existing) {
    if (existing.created_by !== input.userId) {
      throw new AuthError("Profile community belongs to another user", 403);
    }
    return { id: existing.id, name: existing.name };
  }

  const id = crypto.randomUUID();
  const title = formatUserHandle(input.username);
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO subreddits (
             id, name, title, description, created_by, subscriber_count
           ) VALUES (?, ?, ?, ?, ?, 1)`
        )
        .bind(
          id,
          name,
          title,
          "Personal profile posts",
          input.userId
        ),
      db
        .prepare(
          `INSERT INTO subscriptions (user_id, subreddit_id) VALUES (?, ?)`
        )
        .bind(input.userId, id),
      db
        .prepare(
          `INSERT INTO subreddit_moderators (subreddit_id, user_id) VALUES (?, ?)`
        )
        .bind(id, input.userId),
    ]);
  } catch (error) {
    const raced = await db
      .prepare(
        `SELECT id, name, created_by FROM subreddits
         WHERE name = ? COLLATE NOCASE AND is_removed = 0`
      )
      .bind(name)
      .first<{ id: string; name: string; created_by: string | null }>();
    if (raced) {
      if (raced.created_by !== input.userId) {
        throw new AuthError("Profile community belongs to another user", 403);
      }
      return { id: raced.id, name: raced.name };
    }
    throw error;
  }

  return { id, name };
}
