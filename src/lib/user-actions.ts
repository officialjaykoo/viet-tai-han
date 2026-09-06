import { notifyQuietly } from "@/lib/notifications";

import { formatUserHandle, getUsernameProfileHref } from "@/lib/profile-url";
import { syncAchievementsForEvent } from "@/lib/achievements";
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

  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO user_blocks (blocker_id, blocked_id)
         VALUES (?, ?)`
      )
      .bind(blockerId, blockedId),
    db
      .prepare(
        `DELETE FROM user_follows
         WHERE (follower_id = ? AND following_id = ?)
            OR (follower_id = ? AND following_id = ?)`
      )
      .bind(blockerId, blockedId, blockedId, blockerId),
    db
      .prepare(
        `DELETE FROM user_friendships
         WHERE pair_key = ?`
      )
      .bind([blockerId, blockedId].sort().join(":")),
  ]);

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

  const inserted = await db
    .prepare(
      `INSERT OR IGNORE INTO user_follows (follower_id, following_id)
       SELECT ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM user_blocks
         WHERE (blocker_id = ? AND blocked_id = ?)
            OR (blocker_id = ? AND blocked_id = ?)
       )`
    )
    .bind(
      followerId,
      followingId,
      followerId,
      followingId,
      followingId,
      followerId
    )
    .run();
  if (Number(inserted.meta.changes ?? 0) !== 1) {
    const stillBlocked = await db
      .prepare(
        `SELECT 1 AS ok FROM user_blocks
         WHERE (blocker_id = ? AND blocked_id = ?)
            OR (blocker_id = ? AND blocked_id = ?)`
      )
      .bind(followerId, followingId, followingId, followerId)
      .first();
    if (stillBlocked) throw new AuthError("Can't follow this user", 403);
    return { following: true as const };
  }

  const { promotePendingChatRequestsForPair } = await import("@/lib/messages");
  await promotePendingChatRequestsForPair(
    followerId,
    followingId,
    "recipient_followed_sender"
  );
  syncAchievementsForEvent(followerId, "follow");
  syncAchievementsForEvent(followingId, "follow");

  const actor = await db
    .prepare(`SELECT username FROM "user" WHERE id = ?`)
    .bind(followerId)
    .first<{ username: string | null }>();
  notifyQuietly({
    userId: followingId,
    actorId: followerId,
    kind: "follow",
    title: `${formatUserHandle(actor?.username)} followed you`,
    href: getUsernameProfileHref(actor?.username),
  });

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
      blockedByMe: false,
      blockedByThem: false,
      blockedEitherDirection: false,
      friendStatus: "none" as const,
      friendRequestId: null,
      isSelf: viewerId === profileUserId,
    };
  }
  const db = await getDb();
  const [follow, blocks, friend] = await Promise.all([
    db
      .prepare(
        `SELECT 1 AS ok FROM user_follows
         WHERE follower_id = ? AND following_id = ?`
      )
      .bind(viewerId, profileUserId)
      .first(),
    db
      .prepare(
        `SELECT
           EXISTS (
             SELECT 1 FROM user_blocks
             WHERE blocker_id = ? AND blocked_id = ?
           ) AS blocked_by_me,
           EXISTS (
             SELECT 1 FROM user_blocks
             WHERE blocker_id = ? AND blocked_id = ?
           ) AS blocked_by_them`
      )
      .bind(viewerId, profileUserId, profileUserId, viewerId)
      .first<{ blocked_by_me: number; blocked_by_them: number }>(),
    getFriendRelation(viewerId, profileUserId),
  ]);
  const blockedByMe = Boolean(blocks?.blocked_by_me);
  const blockedByThem = Boolean(blocks?.blocked_by_them);
  return {
    following: Boolean(follow),
    blockedByMe,
    blockedByThem,
    blockedEitherDirection: blockedByMe || blockedByThem,
    friendStatus: friend.status,
    friendRequestId: friend.requestId,
    isSelf: false,
  };
}
