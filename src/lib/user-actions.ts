import { getDb } from "@/lib/db";
import { getFriendRelation } from "@/lib/friends";
import { createPublicId } from "@/lib/id";
import { AuthError } from "@/lib/session";

export type ReportReason =
  | "spam"
  | "harassment"
  | "hate"
  | "misinformation"
  | "nsfw"
  | "other";

const REPORT_REASONS = new Set<ReportReason>([
  "spam",
  "harassment",
  "hate",
  "misinformation",
  "nsfw",
  "other",
]);

export async function hidePost(userId: string, postId: string) {
  const db = await getDb();
  const post = await db
    .prepare(`SELECT id FROM posts WHERE id = ? AND is_removed = 0`)
    .bind(postId)
    .first<{ id: string }>();
  if (!post) throw new AuthError("Post not found", 404);

  await db
    .prepare(
      `INSERT OR IGNORE INTO hidden_posts (user_id, post_id) VALUES (?, ?)`
    )
    .bind(userId, postId)
    .run();

  return { hidden: true as const };
}

export async function unhidePost(userId: string, postId: string) {
  const db = await getDb();
  await db
    .prepare(`DELETE FROM hidden_posts WHERE user_id = ? AND post_id = ?`)
    .bind(userId, postId)
    .run();
  return { hidden: false as const };
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) {
    throw new AuthError("You can't block yourself", 400);
  }
  const db = await getDb();
  const user = await db
    .prepare(`SELECT id FROM "user" WHERE id = ?`)
    .bind(blockedId)
    .first<{ id: string }>();
  if (!user) throw new AuthError("User not found", 404);

  await db
    .prepare(
      `INSERT OR IGNORE INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)`
    )
    .bind(blockerId, blockedId)
    .run();

  // Mutual unfollow when blocking
  await db
    .prepare(
      `DELETE FROM user_follows
       WHERE (follower_id = ? AND following_id = ?)
          OR (follower_id = ? AND following_id = ?)`
    )
    .bind(blockerId, blockedId, blockedId, blockerId)
    .run();
  await db
    .prepare(
      `DELETE FROM user_friendships
       WHERE (requester_id = ? AND addressee_id = ?)
          OR (requester_id = ? AND addressee_id = ?)`
    )
    .bind(blockerId, blockedId, blockedId, blockerId)
    .run();

  return { blocked: true as const };
}

export async function unblockUser(blockerId: string, blockedId: string) {
  const db = await getDb();
  await db
    .prepare(
      `DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?`
    )
    .bind(blockerId, blockedId)
    .run();
  return { blocked: false as const };
}

export async function followUser(followerId: string, followingId: string) {
  if (followerId === followingId) {
    throw new AuthError("You can't follow yourself", 400);
  }
  const db = await getDb();
  const user = await db
    .prepare(`SELECT id, status FROM "user" WHERE id = ?`)
    .bind(followingId)
    .first<{ id: string; status: string }>();
  if (!user || user.status === "banned") {
    throw new AuthError("User not found", 404);
  }

  const blocked = await db
    .prepare(
      `SELECT 1 AS ok FROM user_blocks
       WHERE (blocker_id = ? AND blocked_id = ?)
          OR (blocker_id = ? AND blocked_id = ?)`
    )
    .bind(followerId, followingId, followingId, followerId)
    .first();
  if (blocked) {
    throw new AuthError("Can't follow this user", 403);
  }

  await db
    .prepare(
      `INSERT OR IGNORE INTO user_follows (follower_id, following_id) VALUES (?, ?)`
    )
    .bind(followerId, followingId)
    .run();

  const { promotePendingChatRequestsForPair } = await import("@/lib/messages");
  await promotePendingChatRequestsForPair(followerId, followingId);

  void (async () => {
    const { notifyQuietly } = await import("@/lib/notifications");
    const { syncAchievementsQuietly } = await import("@/lib/achievements");
    syncAchievementsQuietly(followerId);
    syncAchievementsQuietly(followingId);
    const actor = await db
      .prepare(`SELECT username FROM "user" WHERE id = ?`)
      .bind(followerId)
      .first<{ username: string | null }>();
    const label = actor?.username ? `u/${actor.username}` : "Someone";
    notifyQuietly({
      userId: followingId,
      actorId: followerId,
      kind: "follow",
      title: `${label} followed you`,
      href: actor?.username ? `/u/${actor.username}` : null,
    });
  })();

  return { following: true as const };
}

export async function unfollowUser(followerId: string, followingId: string) {
  const db = await getDb();
  await db
    .prepare(
      `DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?`
    )
    .bind(followerId, followingId)
    .run();
  return { following: false as const };
}

export async function reportTarget(input: {
  reporterId: string;
  targetType: "post" | "comment" | "user";
  targetId: string;
  reason: string;
  details?: string | null;
}) {
  if (!REPORT_REASONS.has(input.reason as ReportReason)) {
    throw new AuthError("Invalid report reason", 400);
  }

  const db = await getDb();
  if (input.targetType === "post") {
    const post = await db
      .prepare(`SELECT id, author_id FROM posts WHERE id = ?`)
      .bind(input.targetId)
      .first<{ id: string; author_id: string }>();
    if (!post) throw new AuthError("Post not found", 404);
    if (post.author_id === input.reporterId) {
      throw new AuthError("You can't report your own post", 400);
    }
  } else if (input.targetType === "user") {
    if (input.targetId === input.reporterId) {
      throw new AuthError("You can't report yourself", 400);
    }
    const user = await db
      .prepare(`SELECT id FROM "user" WHERE id = ?`)
      .bind(input.targetId)
      .first();
    if (!user) throw new AuthError("User not found", 404);
  } else {
    const comment = await db
      .prepare(`SELECT id, author_id FROM comments WHERE id = ?`)
      .bind(input.targetId)
      .first<{ id: string; author_id: string }>();
    if (!comment) throw new AuthError("Comment not found", 404);
    if (comment.author_id === input.reporterId) {
      throw new AuthError("You can't report your own comment", 400);
    }
  }

  const details = input.details?.trim().slice(0, 500) || null;
  const id = createPublicId();

  try {
    await db
      .prepare(
        `INSERT INTO reports (
           id, reporter_id, target_type, target_id, reason, details
         ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.reporterId,
        input.targetType,
        input.targetId,
        input.reason,
        details
      )
      .run();
  } catch {
    throw new AuthError("You already reported this", 409);
  }

  return { reported: true as const };
}

export async function getProfileRelation(
  viewerId: string | null | undefined,
  profileUserId: string
) {
  if (!viewerId || viewerId === profileUserId) {
    return {
      following: false,
      blocked: false,
      friendStatus: "none" as const,
      friendRequestId: null,
      isSelf: viewerId === profileUserId,
    };
  }
  const db = await getDb();
  const [follow, block, friend] = await Promise.all([
    db
      .prepare(
        `SELECT 1 AS ok FROM user_follows
         WHERE follower_id = ? AND following_id = ?`
      )
      .bind(viewerId, profileUserId)
      .first(),
    db
      .prepare(
        `SELECT 1 AS ok FROM user_blocks
         WHERE blocker_id = ? AND blocked_id = ?`
      )
      .bind(viewerId, profileUserId)
      .first(),
    getFriendRelation(viewerId, profileUserId),
  ]);
  return {
    following: Boolean(follow),
    blocked: Boolean(block),
    friendStatus: friend.status,
    friendRequestId: friend.requestId,
    isSelf: false,
  };
}
