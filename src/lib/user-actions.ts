import { notifyQuietly } from "@/lib/notifications";

import { formatUserHandle, getUsernameProfileHref } from "@/lib/profile-url";
import { syncAchievementsForEvent } from "@/lib/achievements";
import { runBackgroundTask } from "@/lib/background-task";
import { scheduleChatPromotion } from "@/lib/chat-promotion";
import { getDb } from "@/lib/db";
import { getFriendRelation, type FriendState } from "@/lib/friends";
import { getDmRelationship } from "@/lib/dm-relationships";
import { createPublicId } from "@/lib/id";
import { refreshUnreadCounts } from "@/lib/unread";
import { AuthError } from "@/lib/session";

export type FollowState = "none" | "following";
export type BlockState = "none" | "blocked_by_me" | "blocked_by_peer";

export type RelationshipProjection = {
  followState: FollowState;
  friendState: FriendState;
  friendRequestId: string | null;
  blockState: BlockState;
  canViewProfile: boolean;
  canInteract: boolean;
  canMessage: boolean;
  isSelf: boolean;
};
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

  const pair = [blockerId, blockedId].sort().join(":");
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
      .bind(pair),
    db
      .prepare(
        `UPDATE chat_requests
         SET status = 'cancelled',
             responded_at = COALESCE(
               responded_at,
               strftime('%Y-%m-%d %H:%M:%f', 'now')
             )
         WHERE status = 'pending'
           AND (
             (from_user_id = ? AND to_user_id = ?)
             OR (from_user_id = ? AND to_user_id = ?)
           )`
      )
      .bind(blockerId, blockedId, blockedId, blockerId),
    db
      .prepare(
        `DELETE FROM chat_messages
         WHERE delivery_status = 'pending'
           AND EXISTS (
             SELECT 1
             FROM chat_rooms r
             WHERE r.id = chat_messages.room_id
               AND r.pair_key = ?
           )`
      )
      .bind(pair),
    db
      .prepare(
        `UPDATE chat_room_members
         SET membership_status = 'left',
             joined_at = NULL
         WHERE user_id IN (?, ?)
           AND membership_status != 'left'
           AND room_id IN (
             SELECT id FROM chat_rooms WHERE pair_key = ?
           )`
      )
      .bind(blockerId, blockedId, pair),
    db
      .prepare(
        `UPDATE chat_room_members
         SET (last_read_at, last_read_message_id) = (
           SELECT
             CASE
               WHEN chat_room_members.last_read_at IS NULL
                 OR cm.created_at > chat_room_members.last_read_at
                 OR (
                   cm.created_at = chat_room_members.last_read_at
                   AND (
                     chat_room_members.last_read_message_id IS NULL
                     OR cm.id > chat_room_members.last_read_message_id
                   )
                 )
               THEN cm.created_at
               ELSE chat_room_members.last_read_at
             END,
             CASE
               WHEN chat_room_members.last_read_at IS NULL
                 OR cm.created_at > chat_room_members.last_read_at
                 OR (
                   cm.created_at = chat_room_members.last_read_at
                   AND (
                     chat_room_members.last_read_message_id IS NULL
                     OR cm.id > chat_room_members.last_read_message_id
                   )
                 )
               THEN cm.id
               ELSE chat_room_members.last_read_message_id
             END
           FROM chat_messages cm
           WHERE cm.room_id = chat_room_members.room_id
             AND cm.delivery_status = 'delivered'
           ORDER BY cm.created_at DESC, cm.id DESC
           LIMIT 1
         )
         WHERE user_id IN (?, ?)
           AND room_id IN (
             SELECT id FROM chat_rooms WHERE pair_key = ?
           )
           AND EXISTS (
             SELECT 1
             FROM chat_messages cm
             WHERE cm.room_id = chat_room_members.room_id
               AND cm.delivery_status = 'delivered'
           )`
      )
      .bind(blockerId, blockedId, pair),
    db
      .prepare(
        `UPDATE notifications
         SET is_read = 1
         WHERE is_read = 0
           AND kind IN (
             'follow',
             'friend_request',
             'friend_accepted',
             'chat_request',
             'chat_accepted'
           )
           AND (
             (user_id = ? AND actor_id = ?)
             OR (user_id = ? AND actor_id = ?)
           )`
      )
      .bind(blockerId, blockedId, blockedId, blockerId),
  ]);

  runBackgroundTask("blocked_unread_reconcile", async () => {
    await Promise.allSettled([
      refreshUnreadCounts(blockerId),
      refreshUnreadCounts(blockedId),
    ]);
  });

  return { blocked: true as const };
}


export async function unblockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) {
    throw new AuthError("You can't unblock yourself", 400);
  }
  const db = await getDb();
  const user = await db
    .prepare(`SELECT id FROM "user" WHERE id = ?`)
    .bind(blockedId)
    .first<{ id: string }>();
  if (!user) throw new AuthError("User not found", 404);
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
    scheduleChatPromotion({
      firstUserId: followerId,
      secondUserId: followingId,
      reason: "recipient_followed_sender",
    });
    return { followState: "following" as const };
  }

  scheduleChatPromotion({
    firstUserId: followerId,
    secondUserId: followingId,
    reason: "recipient_followed_sender",
  });
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

  return { followState: "following" as const };
}

export async function unfollowUser(followerId: string, followingId: string) {
  const db = await getDb();
  await db
    .prepare(
      `DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?`
    )
    .bind(followerId, followingId)
    .run();
  return { followState: "none" as const };
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
): Promise<RelationshipProjection> {
  const isSelf = viewerId === profileUserId;
  if (!viewerId || isSelf) {
    return {
      followState: "none",
      friendState: "none",
      friendRequestId: null,
      blockState: "none",
      // VTH has public profiles; block currently removes contact permission,
      // not read access. Keep this policy explicit at the service boundary.
      canViewProfile: true,
      canInteract: false,
      canMessage: false,
      isSelf,
    };
  }

  const db = await getDb();
  const [follow, blocks, friend, dm] = await Promise.all([
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
    getDmRelationship({ senderId: viewerId, recipientId: profileUserId }),
  ]);
  const blockedByMe = Boolean(blocks?.blocked_by_me);
  const blockedByThem = Boolean(blocks?.blocked_by_them);
  const blockedEitherDirection = blockedByMe || blockedByThem;
  return {
    followState: follow ? "following" : "none",
    friendState: friend.friendState,
    friendRequestId: friend.requestId,
    blockState: blockedByMe
      ? "blocked_by_me"
      : blockedByThem
        ? "blocked_by_peer"
        : "none",
    canViewProfile: true,
    canInteract: !blockedEitherDirection,
    canMessage:
      !blockedEitherDirection && (dm.directAllowed || dm.requestAllowed),
    isSelf: false,
  };
}
