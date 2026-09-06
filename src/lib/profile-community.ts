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
      `SELECT id, name FROM subreddits WHERE name = ? COLLATE NOCASE AND is_removed = 0`
    )
    .bind(name)
    .first<{ id: string; name: string }>();

  if (existing) {
    return existing;
  }

  const id = crypto.randomUUID();
  const title = formatUserHandle(input.username);
  await db
    .prepare(
      `INSERT INTO subreddits (id, name, title, description, created_by, subscriber_count)
       VALUES (?, ?, ?, ?, ?, 0)`
    )
    .bind(
      id,
      name,
      title,
      "Personal profile posts",
      input.userId
    )
    .run();

  await db
    .prepare(
      `INSERT INTO subscriptions (user_id, subreddit_id) VALUES (?, ?)`
    )
    .bind(input.userId, id)
    .run();

  await db
    .prepare(
      `INSERT INTO subreddit_moderators (subreddit_id, user_id) VALUES (?, ?)`
    )
    .bind(id, input.userId)
    .run();

  const { recountSubscribers } = await import("@/lib/communities");
  await recountSubscribers(id);

  return { id, name };
}
