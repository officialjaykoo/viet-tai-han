import { getDb } from "@/lib/db";
import { listAdCampaigns } from "@/lib/ads";
import { listBurstPosts } from "@/lib/score-integrity";
import { listBusinessVerificationQueue } from "@/lib/businesses";
import { listListingReportQueue } from "@/lib/marketplace";
import { invalidateBannedWordsCache } from "@/lib/moderation";
import { AuthError } from "@/lib/session";

export async function setUserStatus(input: {
  actorId: string;
  targetUserId: string;
  action: "ban" | "unban" | "shadowban" | "unshadowban";
  reason?: string;
}) {
  const statusMap = {
    ban: "banned",
    unban: "active",
    shadowban: "shadowbanned",
    unshadowban: "active",
  } as const;

  const db = await getDb();
  const target = await db
    .prepare(`SELECT id FROM "user" WHERE id = ?`)
    .bind(input.targetUserId)
    .first();
  if (!target) throw new AuthError("User not found", 404);

  await db
    .prepare(
      `UPDATE "user" SET status = ?, updatedAt = datetime('now') WHERE id = ?`
    )
    .bind(statusMap[input.action], input.targetUserId)
    .run();

  await db
    .prepare(
      `INSERT INTO moderation_actions (
         id, actor_id, target_user_id, target_type, target_id, action, reason
       ) VALUES (?, ?, ?, 'user', ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      input.actorId,
      input.targetUserId,
      input.targetUserId,
      input.action,
      input.reason ?? null
    )
    .run();
}

export async function warnUser(input: {
  actorId: string;
  targetUserId: string;
  message: string;
}) {
  const message = input.message.trim();
  if (!message) throw new AuthError("Warning message required", 400);

  const db = await getDb();
  const target = await db
    .prepare(`SELECT id FROM "user" WHERE id = ?`)
    .bind(input.targetUserId)
    .first();
  if (!target) throw new AuthError("User not found", 404);

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO user_warnings (id, user_id, issued_by, message) VALUES (?, ?, ?, ?)`
    )
    .bind(id, input.targetUserId, input.actorId, message)
    .run();

  await db
    .prepare(
      `INSERT INTO moderation_actions (
         id, actor_id, target_user_id, target_type, target_id, action, reason
       ) VALUES (?, ?, ?, 'user', ?, 'warn', ?)`
    )
    .bind(
      crypto.randomUUID(),
      input.actorId,
      input.targetUserId,
      input.targetUserId,
      message
    )
    .run();

  void (async () => {
    const { notifyQuietly } = await import("@/lib/notifications");
    notifyQuietly({
      userId: input.targetUserId,
      actorId: input.actorId,
      kind: "warning",
      title: "You received a warning from moderators",
      body: message,
      href: "/notifications",
    });
  })();

  return { id };
}

export async function deleteAccount(input: {
  actorId: string;
  targetUserId: string;
  reason?: string;
}) {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE "user"
       SET status = 'banned',
           name = 'deleted',
           username = NULL,
           displayUsername = NULL,
           bio = NULL,
           email = 'deleted_' || id || '@red.invalid',
           updatedAt = datetime('now')
       WHERE id = ?`
    )
    .bind(input.targetUserId)
    .run();

  await db
    .prepare(
      `UPDATE posts SET is_removed = 1, updated_at = datetime('now') WHERE author_id = ?`
    )
    .bind(input.targetUserId)
    .run();

  await db
    .prepare(
      `UPDATE comments
       SET is_deleted = 1, is_removed = 1, body = '[deleted]', updated_at = datetime('now')
       WHERE author_id = ?`
    )
    .bind(input.targetUserId)
    .run();

  await db
    .prepare(
      `INSERT INTO moderation_actions (
         id, actor_id, target_user_id, target_type, target_id, action, reason
       ) VALUES (?, ?, ?, 'user', ?, 'delete_account', ?)`
    )
    .bind(
      crypto.randomUUID(),
      input.actorId,
      input.targetUserId,
      input.targetUserId,
      input.reason ?? null
    )
    .run();
}

export async function deleteSubreddit(input: {
  actorId: string;
  subredditId: string;
  reason?: string;
}) {
  const db = await getDb();
  const sub = await db
    .prepare(`SELECT id FROM subreddits WHERE id = ?`)
    .bind(input.subredditId)
    .first();
  if (!sub) throw new AuthError("Subreddit not found", 404);

  await db
    .prepare(
      `UPDATE subreddits SET is_removed = 1, updated_at = datetime('now') WHERE id = ?`
    )
    .bind(input.subredditId)
    .run();

  await db
    .prepare(
      `UPDATE posts SET is_removed = 1, updated_at = datetime('now') WHERE subreddit_id = ?`
    )
    .bind(input.subredditId)
    .run();

  await db
    .prepare(
      `INSERT INTO moderation_actions (
         id, actor_id, target_type, target_id, action, reason
       ) VALUES (?, ?, 'subreddit', ?, 'delete_subreddit', ?)`
    )
    .bind(
      crypto.randomUUID(),
      input.actorId,
      input.subredditId,
      input.reason ?? null
    )
    .run();
}

export async function addBannedWord(input: {
  actorId: string;
  word: string;
  severity: "shadow" | "block";
}) {
  const word = input.word.trim().toLowerCase();
  if (word.length < 2) throw new AuthError("Word too short", 400);
  if (!["shadow", "block"].includes(input.severity)) {
    throw new AuthError("Invalid severity", 400);
  }

  const db = await getDb();
  const id = crypto.randomUUID();
  try {
    await db
      .prepare(
        `INSERT INTO banned_words (id, word, severity, created_by) VALUES (?, ?, ?, ?)`
      )
      .bind(id, word, input.severity, input.actorId)
      .run();
  } catch {
    throw new AuthError("Word already banned", 409);
  }
  invalidateBannedWordsCache().catch(() => {
    // cache best-effort
  });
  return { id, word, severity: input.severity };
}

export async function removeBannedWord(id: string) {
  const db = await getDb();
  await db.prepare(`DELETE FROM banned_words WHERE id = ?`).bind(id).run();
  invalidateBannedWordsCache().catch(() => {
    // cache best-effort
  });
}

export async function getAdminOverview() {
  const db = await getDb();
  const counts = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM "user") AS users,
         (SELECT COUNT(*) FROM posts WHERE is_removed = 0) AS posts,
         (SELECT COUNT(*) FROM comments WHERE is_removed = 0) AS comments,
         (SELECT COUNT(*) FROM subreddits WHERE is_removed = 0) AS subreddits,
         (SELECT COUNT(*) FROM listings WHERE status != 'removed') AS listings,
         (SELECT COUNT(*) FROM businesses WHERE status != 'removed') AS businesses,
         (SELECT COUNT(*) FROM business_verification_requests WHERE status = 'pending') AS pending_business_verifications,
         (SELECT COUNT(*) FROM listing_reports WHERE status = 'open') AS open_listing_reports,
         (SELECT COUNT(*) FROM "user" WHERE status = 'banned') AS banned,
         (SELECT COUNT(*) FROM "user" WHERE status = 'shadowbanned') AS shadowbanned,
         (SELECT COUNT(*) FROM banned_words) AS banned_words`
    )
    .first<{
      users: number;
      posts: number;
      comments: number;
      businesses: number;
      pending_business_verifications: number;
      subreddits: number;
      listings: number;
      open_listing_reports: number;
      banned: number;
      shadowbanned: number;
      banned_words: number;
    }>();

  const { results: recentActions } = await db
    .prepare(
      `SELECT id, actor_id, target_user_id, target_type, target_id, action, reason, created_at
       FROM moderation_actions
       ORDER BY created_at DESC
       LIMIT 25`
    )
    .all();

  const { results: warnings } = await db
    .prepare(
      `SELECT id, user_id, issued_by, message, created_at
       FROM user_warnings
       ORDER BY created_at DESC
       LIMIT 25`
    )
    .all();

  const { results: bannedWords } = await db
    .prepare(
      `SELECT id, word, severity, created_at FROM banned_words ORDER BY word`
    )
    .all();

  const { results: users } = await db
    .prepare(
      `SELECT id, username, name, role, status, karma, createdAt
       FROM "user"
       ORDER BY createdAt DESC
       LIMIT 50`
    )
    .all();

  const [burstPosts, adCampaigns, listingReports, businessVerifications] =
    await Promise.all([
      listBurstPosts(15),
      listAdCampaigns(),
      listListingReportQueue("open"),
      listBusinessVerificationQueue("pending"),
    ]);

  return {
    counts: counts ?? {
      users: 0,
      posts: 0,
      comments: 0,
      subreddits: 0,
      listings: 0,
      businesses: 0,
      pending_business_verifications: 0,
      open_listing_reports: 0,
      banned: 0,
      shadowbanned: 0,
      banned_words: 0,
    },
    recentActions: recentActions ?? [],
    warnings: warnings ?? [],
    bannedWords: bannedWords ?? [],
    users: users ?? [],
    burstPosts,
    businessVerifications,
    adCampaigns,
    listingReports,
  };
}
