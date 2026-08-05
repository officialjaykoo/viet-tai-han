import {
  LEVEL_THRESHOLDS,
  levelForValue,
  resolveAgeBadge,
  resolveKarmaBadge,
} from "@/lib/achievement-levels";
import { getDb } from "@/lib/db";
import {
  LAEFYE_SLUG,
  mentionsLaefye,
} from "@/lib/easter-eggs/laefye";
import {
  VETERAN_DAYS,
  VETERAN_KARMA,
  accountAgeDays,
} from "@/lib/tags";

export type AchievementKind = "tag" | "achievement" | "badge";

export type UserAchievement = {
  id: string;
  slug: string;
  title: string;
  description: string;
  kind: AchievementKind;
  category: string;
  maxLevel: number;
  level: number;
  earnedAt: string;
  updatedAt: string;
};

async function upsertGrant(
  userId: string,
  slug: string,
  level: number
): Promise<boolean> {
  if (level < 1) return false;
  const db = await getDb();
  const achievement = await db
    .prepare(
      `SELECT id, max_level AS maxLevel FROM achievements WHERE slug = ?`
    )
    .bind(slug)
    .first<{ id: string; maxLevel: number }>();
  if (!achievement) return false;

  const capped = Math.min(level, achievement.maxLevel);
  const existing = await db
    .prepare(
      `SELECT level FROM user_achievements
       WHERE user_id = ? AND achievement_id = ?`
    )
    .bind(userId, achievement.id)
    .first<{ level: number }>();

  if (!existing) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, level)
         VALUES (?, ?, ?)`
      )
      .bind(userId, achievement.id, capped)
      .run();
    return true;
  }

  if (capped > existing.level) {
    await db
      .prepare(
        `UPDATE user_achievements
         SET level = ?, updated_at = datetime('now')
         WHERE user_id = ? AND achievement_id = ?`
      )
      .bind(capped, userId, achievement.id)
      .run();
    return true;
  }

  return false;
}

export async function listUserAchievements(userId: string) {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT
         a.id, a.slug, a.title, a.description, a.kind, a.category,
         a.max_level AS maxLevel,
         ua.level, ua.earned_at AS earnedAt, ua.updated_at AS updatedAt
       FROM user_achievements ua
       INNER JOIN achievements a ON a.id = ua.achievement_id
       WHERE ua.user_id = ?
       ORDER BY
         CASE a.kind WHEN 'badge' THEN 0 WHEN 'tag' THEN 1 ELSE 2 END,
         a.sort_order ASC,
         ua.earned_at ASC`
    )
    .bind(userId)
    .all<UserAchievement>();
  return results ?? [];
}

export async function hasAchievement(userId: string, slug: string) {
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT 1 AS ok
       FROM user_achievements ua
       INNER JOIN achievements a ON a.id = ua.achievement_id
       WHERE ua.user_id = ? AND a.slug = ?`
    )
    .bind(userId, slug)
    .first();
  return Boolean(row);
}

/** True if the user has a live post/comment that mentions "laefye". */
async function userHasLaefyeMention(userId: string): Promise<boolean> {
  const db = await getDb();
  const { results: posts } = await db
    .prepare(
      `SELECT title, body FROM posts
       WHERE author_id = ? AND is_removed = 0
         AND (
           title LIKE '%laefye%' COLLATE NOCASE
           OR IFNULL(body, '') LIKE '%laefye%' COLLATE NOCASE
         )
       LIMIT 25`
    )
    .bind(userId)
    .all<{ title: string; body: string | null }>();

  if ((posts ?? []).some((p) => mentionsLaefye(p.title, p.body))) {
    return true;
  }

  const { results: comments } = await db
    .prepare(
      `SELECT body FROM comments
       WHERE author_id = ? AND is_deleted = 0 AND is_removed = 0
         AND body LIKE '%laefye%' COLLATE NOCASE
       LIMIT 25`
    )
    .bind(userId)
    .all<{ body: string }>();

  return (comments ?? []).some((c) => mentionsLaefye(c.body));
}

/** Evaluate and grant/level achievements based on current user state. */
export async function syncUserAchievements(userId: string) {
  const db = await getDb();
  const user = await db
    .prepare(
      `SELECT id, role, karma, createdAt, isNsfw,
              (SELECT COUNT(*) FROM posts WHERE author_id = ? AND is_removed = 0) AS postCount,
              (SELECT COUNT(*) FROM comments WHERE author_id = ? AND is_deleted = 0 AND is_removed = 0) AS commentCount,
              (SELECT COUNT(*) FROM subreddits WHERE created_by = ?) AS communityCount,
              (SELECT COUNT(*) FROM subreddit_moderators WHERE user_id = ?) AS modCount,
              (SELECT COUNT(*) FROM user_follows WHERE following_id = ?) AS followerCount,
              (SELECT COUNT(*) FROM user_follows WHERE follower_id = ?) AS followingCount,
              (SELECT COUNT(*) FROM votes WHERE user_id = ? AND value != 0) AS voteCount,
              (SELECT COALESCE(MAX(score), 0) FROM posts WHERE author_id = ? AND is_removed = 0) AS bestPostScore,
              (SELECT COUNT(*) FROM posts WHERE author_id = ? AND is_removed = 0 AND url IS NOT NULL AND url != '') AS linkPostCount,
              (SELECT COUNT(*) FROM posts WHERE author_id = ? AND is_removed = 0 AND media_key IS NOT NULL) AS mediaPostCount,
              (SELECT COUNT(*) FROM comments c
                 INNER JOIN comments r ON r.parent_id = c.id AND r.is_deleted = 0 AND r.is_removed = 0
               WHERE c.author_id = ? AND c.is_deleted = 0 AND c.is_removed = 0) AS replyCount,
              (SELECT COUNT(*) FROM posts p
                 WHERE p.author_id = ? AND p.is_removed = 0
                   AND date(p.created_at) = date('now')
                   AND EXISTS (
                     SELECT 1 FROM comments c
                     WHERE c.author_id = p.author_id AND c.is_deleted = 0
                       AND date(c.created_at) = date('now')
                   )) AS sameDayPostAndComment
       FROM "user" WHERE id = ?`
    )
    .bind(
      userId,
      userId,
      userId,
      userId,
      userId,
      userId,
      userId,
      userId,
      userId,
      userId,
      userId,
      userId,
      userId
    )
    .first<{
      id: string;
      role: string;
      karma: number;
      createdAt: string;
      isNsfw: number;
      postCount: number;
      commentCount: number;
      communityCount: number;
      modCount: number;
      followerCount: number;
      followingCount: number;
      voteCount: number;
      bestPostScore: number;
      linkPostCount: number;
      mediaPostCount: number;
      replyCount: number;
      sameDayPostAndComment: number;
    }>();

  if (!user) return [];

  const granted: string[] = [];
  const bump = async (slug: string, level: number) => {
    if (await upsertGrant(userId, slug, level)) granted.push(slug);
  };

  // Status tags
  await bump("admin", user.role === "admin" ? 1 : 0);
  await bump(
    "moderator",
    user.role === "moderator" || user.role === "admin" || user.modCount > 0
      ? 1
      : 0
  );
  const ageDays = accountAgeDays(user.createdAt);
  await bump(
    "veteran",
    ageDays >= VETERAN_DAYS || user.karma >= VETERAN_KARMA ? 1 : 0
  );
  await bump("nsfw", user.isNsfw === 1 ? 1 : 0);

  // Welcome
  await bump("welcome", 1);

  // Legacy one-shots
  await bump("first_post", user.postCount >= 1 ? 1 : 0);
  await bump("first_comment", user.commentCount >= 1 ? 1 : 0);
  await bump("karma_100", user.karma >= 100 ? 1 : 0);
  await bump("karma_1000", user.karma >= 1000 ? 1 : 0);
  await bump("community_builder", user.communityCount >= 1 ? 1 : 0);
  await bump("busy_bee", user.sameDayPostAndComment > 0 ? 1 : 0);

  // Easter egg: mention "laefye" in a post or comment
  await bump(
    LAEFYE_SLUG,
    (await userHasLaefyeMention(userId)) ? 1 : 0
  );

  // Leveled trophies
  await bump(
    "poster",
    levelForValue(LEVEL_THRESHOLDS.poster, user.postCount)
  );
  await bump(
    "commenter",
    levelForValue(LEVEL_THRESHOLDS.commenter, user.commentCount)
  );
  await bump(
    "karma_climber",
    levelForValue(LEVEL_THRESHOLDS.karma_climber, user.karma)
  );
  await bump(
    "community_leader",
    levelForValue(LEVEL_THRESHOLDS.community_leader, user.communityCount)
  );
  await bump(
    "follower_magnet",
    levelForValue(LEVEL_THRESHOLDS.follower_magnet, user.followerCount)
  );
  await bump(
    "social_butterfly",
    levelForValue(LEVEL_THRESHOLDS.social_butterfly, user.followingCount)
  );
  await bump(
    "popular_post",
    levelForValue(LEVEL_THRESHOLDS.popular_post, user.bestPostScore)
  );
  await bump("voter", levelForValue(LEVEL_THRESHOLDS.voter, user.voteCount));
  await bump(
    "conversationalist",
    levelForValue(LEVEL_THRESHOLDS.conversationalist, user.replyCount)
  );
  await bump(
    "link_poster",
    levelForValue(LEVEL_THRESHOLDS.link_poster, user.linkPostCount)
  );
  await bump(
    "media_maven",
    levelForValue(LEVEL_THRESHOLDS.media_maven, user.mediaPostCount)
  );

  // Cake day years (1+ full years)
  const years = Math.floor(ageDays / 365);
  await bump("cake_day", levelForValue(LEVEL_THRESHOLDS.cake_day, years));

  // Display badges (always at least level 1)
  const karmaBadge = resolveKarmaBadge(user.karma);
  const ageBadge = resolveAgeBadge(user.createdAt);
  await bump("badge_karma", karmaBadge.level);
  await bump("badge_age", ageBadge.level);

  // Revoke NSFW tag if turned off
  if (user.isNsfw !== 1) {
    await db
      .prepare(
        `DELETE FROM user_achievements
         WHERE user_id = ?
           AND achievement_id = (SELECT id FROM achievements WHERE slug = 'nsfw')`
      )
      .bind(userId)
      .run();
  }

  // Revoke admin/mod tags if no longer applicable
  if (user.role !== "admin") {
    await db
      .prepare(
        `DELETE FROM user_achievements
         WHERE user_id = ?
           AND achievement_id = (SELECT id FROM achievements WHERE slug = 'admin')`
      )
      .bind(userId)
      .run();
  }
  if (
    user.role !== "moderator" &&
    user.role !== "admin" &&
    user.modCount === 0
  ) {
    await db
      .prepare(
        `DELETE FROM user_achievements
         WHERE user_id = ?
           AND achievement_id = (SELECT id FROM achievements WHERE slug = 'moderator')`
      )
      .bind(userId)
      .run();
  }

  return granted;
}

export async function setUserNsfw(userId: string, isNsfw: boolean) {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE "user" SET isNsfw = ?, updatedAt = datetime('now') WHERE id = ?`
    )
    .bind(isNsfw ? 1 : 0, userId)
    .run();
  await syncUserAchievements(userId);
  return { isNsfw };
}

/** Fire-and-forget sync after karma / social events. */
export function syncAchievementsQuietly(userId: string) {
  void syncUserAchievements(userId).catch((error) => {
    console.error("achievement sync failed", error);
  });
}
