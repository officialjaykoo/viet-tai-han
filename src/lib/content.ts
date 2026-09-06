import { getDb } from "@/lib/db";
import type {
  ContentSourceLang,
  ContentTranslation,
  ContentTranslationStatus,
  FeedPost,
  ViewerVote,
} from "@/lib/types";
import type { AccountBadge } from "@/lib/achievement-levels";
import { resolveAccountBadges } from "@/lib/achievement-levels";
import { resolveAccountTags, type AccountTag } from "@/lib/tags";
import { displayScore, personalizedDisplayScore } from "@/lib/vote-weight";
import { voteValueToAction } from "@/lib/votes";

export interface CommentNode {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  score: number;
  likeCount: number;
  depth: number;
  createdAt: string;
  isDeleted: boolean;
  viewerVote: ViewerVote;
  translation: ContentTranslation | null;
  author: {
    id?: string;
    username: string | null;
    displayName: string | null;
    image: string | null;
    tags: AccountTag[];
    isAuthor: boolean;
  };
  children: CommentNode[];
}

export interface PostDetail extends FeedPost {
  isLocked: boolean;
  comments: CommentNode[];
}

export interface SubredditDetail {
  id: string;
  name: string;
  title: string;
  description: string | null;
  subscriberCount: number;
  createdAt: string;
  createdBy: string | null;
}

export interface PublicProfile {
  id: string;
  username: string | null;
  name: string;
  image: string | null;
  bio: string | null;
  bannerKey: string | null;
  karma: number;
  postKarma: number;
  commentKarma: number;
  createdAt: string;
  status: string;
  role: string;
  isNsfw: boolean;
  tags: AccountTag[];
  badges: AccountBadge[];
}

function mapTranslation(row: {
  source_lang?: string | null;
  translation_target_lang?: string | null;
  translation_status?: string | null;
  title_translated?: string | null;
  body_translated?: string | null;
}): ContentTranslation | null {
  const status = (row.translation_status ??
    "pending") as ContentTranslationStatus;
  if (status !== "ready") {
    return {
      sourceLang: (row.source_lang as ContentSourceLang | null) ?? null,
      targetLang: (row.translation_target_lang as ContentTranslation["targetLang"]) ?? null,
      status,
      titleTranslated: null,
      bodyTranslated: null,
    };
  }
  return {
    sourceLang: (row.source_lang as ContentSourceLang | null) ?? null,
    targetLang: (row.translation_target_lang as ContentTranslation["targetLang"]) ?? null,
    status,
    titleTranslated: row.title_translated ?? null,
    bodyTranslated: row.body_translated ?? null,
  };
}

function mapFeedRow(
  row: {
    id: string;
    title: string;
    body: string | null;
    url: string | null;
    media_key: string | null;
    upvotes: number;
    downvotes: number;
    score: number;
    comment_count: number;
    created_at: string;
    source_lang?: string | null;
    translation_target_lang?: string | null;
    title_translated?: string | null;
    body_translated?: string | null;
    translation_status?: string | null;
    author_id: string;
    author_username: string | null;
    author_display_name: string | null;
    author_image?: string | null;
    author_role?: string | null;
    author_is_nsfw?: number | null;
    author_created_at?: string | null;
    author_karma?: number | null;
    author_is_community_mod?: number | null;
    author_has_veteran?: number | null;
    subreddit_id: string;
    subreddit_name: string;
    subreddit_title: string;
    viewer_vote?: number | null;
    viewer_vote_weight?: number | null;
  },
  viewerUserId?: string | null
): FeedPost {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    url: row.url,
    mediaKey: row.media_key,
    score:
      row.viewer_vote == null
        ? displayScore(row.score)
        : personalizedDisplayScore(row.score, {
            value: row.viewer_vote,
            weight: Number(row.viewer_vote_weight ?? 1),
          }),
    commentCount: row.comment_count,
    createdAt: row.created_at,
    likeCount: row.upvotes,
    viewerVote: voteValueToAction(row.viewer_vote),
    translation: mapTranslation(row),
    author: {
      id: row.author_id,
      username: row.author_username ?? "unknown",
      displayName: row.author_display_name,
      image: row.author_image ?? null,
      tags: resolveAccountTags({
        role: row.author_role,
        isNsfw: row.author_is_nsfw,
        createdAt: row.author_created_at,
        karma: row.author_karma,
        isCommunityMod: Boolean(row.author_is_community_mod),
        hasVeteranAchievement: Boolean(row.author_has_veteran),
      }),
      isAuthor: Boolean(viewerUserId && viewerUserId === row.author_id),
    },
    subreddit: {
      id: row.subreddit_id,
      name: row.subreddit_name,
      title: row.subreddit_title,
    },
  };
}

const AUTHOR_TAG_SELECT = `
  u.role AS author_role,
  u.isNsfw AS author_is_nsfw,
  u.createdAt AS author_created_at,
  u.karma AS author_karma,
  EXISTS (
    SELECT 1 FROM subreddit_moderators sm
    WHERE sm.subreddit_id = p.subreddit_id AND sm.user_id = p.author_id
  ) AS author_is_community_mod,
  EXISTS (
    SELECT 1 FROM user_achievements ua
    INNER JOIN achievements a ON a.id = ua.achievement_id
    WHERE ua.user_id = u.id AND a.slug = 'veteran'
  ) AS author_has_veteran`;

const COMMENT_AUTHOR_TAG_SELECT = `
  u.role AS author_role,
  u.isNsfw AS author_is_nsfw,
  u.createdAt AS author_created_at,
  u.karma AS author_karma,
  EXISTS (
    SELECT 1 FROM subreddit_moderators sm
    INNER JOIN posts pmod ON pmod.subreddit_id = sm.subreddit_id
    WHERE pmod.id = c.post_id AND sm.user_id = c.author_id
  ) AS author_is_community_mod,
  EXISTS (
    SELECT 1 FROM user_achievements ua
    INNER JOIN achievements a ON a.id = ua.achievement_id
    WHERE ua.user_id = u.id AND a.slug = 'veteran'
  ) AS author_has_veteran`;

export async function getSubredditByName(name: string) {
  const db = await getDb();
  return db
    .prepare(
      `SELECT id, name, title, description, subscriber_count, created_at, created_by, is_removed
       FROM subreddits WHERE name = ? COLLATE NOCASE`
    )
    .bind(name)
    .first<{
      id: string;
      name: string;
      title: string;
      description: string | null;
      subscriber_count: number;
      created_at: string;
      created_by: string | null;
      is_removed: number;
    }>();
}

export async function listSubreddits(limit = 50) {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT id, name, title, description, subscriber_count, created_at
       FROM subreddits
       WHERE is_removed = 0
       ORDER BY subscriber_count DESC, name ASC
       LIMIT ?`
    )
    .bind(limit)
    .all();
  return (results ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    subscriberCount: Number(row.subscriber_count ?? 0),
    createdAt: String(row.created_at),
  }));
}

export async function getPostDetail(
  postId: string,
  viewerUserId?: string | null
): Promise<PostDetail | null> {
  const db = await getDb();
  const post = viewerUserId
    ? await db
        .prepare(
          `SELECT
             p.id, p.title, p.body, p.url, p.media_key,
             p.upvotes, p.downvotes, p.score, p.comment_count, p.created_at, p.is_locked,
             p.source_lang, p.title_translated, p.body_translated, p.translation_status,
             p.translation_target_lang,
             u.id AS author_id, u.username AS author_username,
             u.name AS author_display_name,
             u.image AS author_image,
             ${AUTHOR_TAG_SELECT},
             s.id AS subreddit_id, s.name AS subreddit_name, s.title AS subreddit_title,
             v.value AS viewer_vote,
             v.weight AS viewer_vote_weight
           FROM posts p
           INNER JOIN "user" u ON u.id = p.author_id
           INNER JOIN subreddits s ON s.id = p.subreddit_id
           LEFT JOIN votes v
             ON v.target_type = 'post' AND v.target_id = p.id AND v.user_id = ?
           WHERE p.id = ? AND p.is_removed = 0`
        )
        .bind(viewerUserId, postId)
        .first()
    : await db
        .prepare(
          `SELECT
             p.id, p.title, p.body, p.url, p.media_key,
             p.upvotes, p.downvotes, p.score, p.comment_count, p.created_at, p.is_locked,
             p.source_lang, p.title_translated, p.body_translated, p.translation_status,
             p.translation_target_lang,
             u.id AS author_id, u.username AS author_username,
             u.name AS author_display_name,
             u.image AS author_image,
             ${AUTHOR_TAG_SELECT},
             s.id AS subreddit_id, s.name AS subreddit_name, s.title AS subreddit_title,
             NULL AS viewer_vote,
             NULL AS viewer_vote_weight
           FROM posts p
           INNER JOIN "user" u ON u.id = p.author_id
           INNER JOIN subreddits s ON s.id = p.subreddit_id
           WHERE p.id = ? AND p.is_removed = 0`
        )
        .bind(postId)
        .first();

  if (!post) return null;

  const { results } = viewerUserId
    ? await db
        .prepare(
          `SELECT
             c.id, c.post_id, c.parent_id, c.body, c.score, c.upvotes, c.downvotes,
             c.depth, c.created_at, c.is_deleted, c.is_shadow_hidden,
             c.source_lang, c.body_translated, c.translation_status,
             c.translation_target_lang,
             u.id AS author_id, u.username AS author_username,
             u.name AS author_display_name,
             u.image AS author_image,
             ${COMMENT_AUTHOR_TAG_SELECT},
             v.value AS viewer_vote,
             v.weight AS viewer_vote_weight
           FROM comments c
           INNER JOIN "user" u ON u.id = c.author_id
           LEFT JOIN votes v
             ON v.target_type = 'comment' AND v.target_id = c.id AND v.user_id = ?
           WHERE c.post_id = ? AND c.is_removed = 0
           ORDER BY c.created_at ASC`
        )
        .bind(viewerUserId, postId)
        .all()
    : await db
        .prepare(
          `SELECT
             c.id, c.post_id, c.parent_id, c.body, c.score, c.upvotes, c.downvotes,
             c.depth, c.created_at, c.is_deleted, c.is_shadow_hidden,
             c.source_lang, c.body_translated, c.translation_status,
             c.translation_target_lang,
             u.id AS author_id, u.username AS author_username,
             u.name AS author_display_name,
             u.image AS author_image,
             ${COMMENT_AUTHOR_TAG_SELECT},
             NULL AS viewer_vote,
             NULL AS viewer_vote_weight
           FROM comments c
           INNER JOIN "user" u ON u.id = c.author_id
           WHERE c.post_id = ? AND c.is_removed = 0
           ORDER BY c.created_at ASC`
        )
        .bind(postId)
        .all();

  const nodes = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const raw of results ?? []) {
    const row = raw as {
      id: string;
      post_id: string;
      parent_id: string | null;
      body: string;
      score: number;
      upvotes: number;
      downvotes: number;
      depth: number;
      created_at: string;
      is_deleted: number;
      is_shadow_hidden: number;
      source_lang: string | null;
      translation_target_lang: string | null;
      body_translated: string | null;
      translation_status: string | null;
      author_id: string;
      author_username: string | null;
      author_display_name: string | null;
      author_image: string | null;
      author_role: string | null;
      author_is_nsfw: number | null;
      author_created_at: string | null;
      author_karma: number | null;
      author_is_community_mod: number | null;
      author_has_veteran: number | null;
      viewer_vote: number | null;
      viewer_vote_weight: number | null;
    };
    if (row.is_shadow_hidden) continue;
    const node: CommentNode = {
      id: row.id,
      postId: row.post_id,
      parentId: row.parent_id,
      body: row.is_deleted ? "[deleted]" : row.body,
      score:
        row.viewer_vote == null
          ? displayScore(row.score)
          : personalizedDisplayScore(row.score, {
              value: row.viewer_vote,
              weight: Number(row.viewer_vote_weight ?? 1),
            }),
      likeCount: row.upvotes,
      depth: row.depth,
      createdAt: row.created_at,
      isDeleted: Boolean(row.is_deleted),
      viewerVote: voteValueToAction(row.viewer_vote),
      translation: row.is_deleted
        ? null
        : mapTranslation({
            source_lang: row.source_lang,
            translation_target_lang: row.translation_target_lang,
            translation_status: row.translation_status,
            body_translated: row.body_translated,
          }),
      author: {
        id: row.author_id,
        username: row.author_username,
        displayName: row.author_display_name,
        image: row.author_image,
        tags: resolveAccountTags({
          role: row.author_role,
          isNsfw: row.author_is_nsfw,
          createdAt: row.author_created_at,
          karma: row.author_karma,
          isCommunityMod: Boolean(row.author_is_community_mod),
          hasVeteranAchievement: Boolean(row.author_has_veteran),
        }),
        isAuthor: Boolean(viewerUserId && viewerUserId === row.author_id),
      },
      children: [],
    };
    nodes.set(node.id, node);
  }

  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return {
    ...mapFeedRow(post as Parameters<typeof mapFeedRow>[0], viewerUserId),
    isLocked: Boolean((post as { is_locked: number }).is_locked),
    comments: roots,
  };
}

type PublicProfileRow = {
  id: string;
  username: string | null;
  name: string;
  image: string | null;
  bio: string | null;
  bannerKey: string | null;
  karma: number;
  postKarma: number;
  commentKarma: number;
  createdAt: string;
  status: string;
  role: string;
  isNsfw: number;
  has_veteran: number;
  is_community_mod: number;
};

const PUBLIC_PROFILE_SELECT = `
  SELECT u.id, u.username, u.name, u.image, u.bio, u.bannerKey, u.karma,
         u.postKarma, u.commentKarma, u.createdAt, u.status, u.role, u.isNsfw,
         EXISTS (
           SELECT 1 FROM user_achievements ua
           INNER JOIN achievements a ON a.id = ua.achievement_id
           WHERE ua.user_id = u.id AND a.slug = 'veteran'
         ) AS has_veteran,
         EXISTS (
           SELECT 1 FROM subreddit_moderators
           WHERE user_id = u.id
         ) AS is_community_mod
`;

function mapPublicProfile(row: PublicProfileRow): PublicProfile {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    image: row.image,
    bio: row.bio,
    bannerKey: row.bannerKey,
    karma: row.karma,
    postKarma: row.postKarma,
    commentKarma: row.commentKarma,
    createdAt: row.createdAt,
    status: row.status,
    role: row.role,
    isNsfw: Boolean(row.isNsfw),
    tags: resolveAccountTags({
      role: row.role,
      isNsfw: row.isNsfw,
      createdAt: row.createdAt,
      karma: row.karma,
      isCommunityMod: Boolean(row.is_community_mod),
      hasVeteranAchievement: Boolean(row.has_veteran),
    }),
    badges: resolveAccountBadges({
      karma: row.karma,
      createdAt: row.createdAt,
    }),
  };
}

export type PublicProfileLookup = {
  profile: PublicProfile;
  redirectUsername: string | null;
};

export async function resolvePublicProfile(
  username: string
): Promise<PublicProfileLookup | null> {
  const db = await getDb();
  const current = await db
    .prepare(
      `${PUBLIC_PROFILE_SELECT}
       FROM "user" u
       WHERE u.username = ? COLLATE NOCASE`
    )
    .bind(username)
    .first<PublicProfileRow>();
  if (current) {
    return { profile: mapPublicProfile(current), redirectUsername: null };
  }

  const historical = await db
    .prepare(
      `${PUBLIC_PROFILE_SELECT}, h.username AS historicalUsername
       FROM username_history h
       INNER JOIN "user" u ON u.id = h.userId
       WHERE h.username = ? COLLATE NOCASE
         AND u.username IS NOT NULL
       ORDER BY h.changedAt DESC
       LIMIT 1`
    )
    .bind(username)
    .first<PublicProfileRow & { historicalUsername: string }>();
  if (!historical) return null;

  return {
    profile: mapPublicProfile(historical),
    redirectUsername: historical.username,
  };
}

export async function getPublicProfile(
  identifier: string
): Promise<PublicProfile | null> {
  return (await resolvePublicProfile(identifier))?.profile ?? null;
}

export async function getRecommendations(userId: string, limit = 10) {
  const db = await getDb();

  const { queryRecommendedPostIds } = await import("@/lib/embeddings");
  const vectorIds = await queryRecommendedPostIds(userId, limit);

  if (vectorIds && vectorIds.length > 0) {
    const placeholders = vectorIds.map(() => "?").join(", ");
    const { results } = await db
      .prepare(
        `SELECT
           p.id, p.title, p.body, p.url, p.media_key,
           p.upvotes, p.downvotes, p.score, p.comment_count, p.created_at,
           p.source_lang, p.title_translated, p.body_translated, p.translation_status,
           p.translation_target_lang,
           u.id AS author_id, u.username AS author_username,
           u.name AS author_display_name,
           u.image AS author_image,
           ${AUTHOR_TAG_SELECT},
           s.id AS subreddit_id, s.name AS subreddit_name, s.title AS subreddit_title,
           v.value AS viewer_vote
         FROM posts p
         INNER JOIN "user" u ON u.id = p.author_id
         INNER JOIN subreddits s ON s.id = p.subreddit_id
         LEFT JOIN votes v
           ON v.target_type = 'post' AND v.target_id = p.id AND v.user_id = ?
         WHERE p.id IN (${placeholders})
           AND p.is_removed = 0 AND p.is_shadow_hidden = 0
           AND p.author_id != ?
           AND p.id NOT IN (SELECT post_id FROM hidden_posts WHERE user_id = ?)
           AND p.author_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ?)`
      )
      .bind(userId, ...vectorIds, userId, userId, userId)
      .all();

    const byId = new Map(
      (results ?? []).map((row) => {
        const mapped = mapFeedRow(
          row as Parameters<typeof mapFeedRow>[0],
          userId
        );
        return [mapped.id, mapped] as const;
      })
    );

    const ordered = vectorIds
      .map((id) => byId.get(id))
      .filter((post): post is NonNullable<typeof post> => Boolean(post))
      .slice(0, limit);

    if (ordered.length > 0) {
      return ordered;
    }
  }

  const { results } = await db
    .prepare(
      `SELECT
         p.id, p.title, p.body, p.url, p.media_key,
         p.upvotes, p.downvotes, p.score, p.comment_count, p.created_at,
         p.source_lang, p.title_translated, p.body_translated, p.translation_status,
         p.translation_target_lang,
         u.id AS author_id, u.username AS author_username,
         u.name AS author_display_name,
         u.image AS author_image,
         ${AUTHOR_TAG_SELECT},
         s.id AS subreddit_id, s.name AS subreddit_name, s.title AS subreddit_title,
         v.value AS viewer_vote
       FROM user_activity ua
       INNER JOIN posts p ON p.subreddit_id = ua.subreddit_id
       INNER JOIN "user" u ON u.id = p.author_id
       INNER JOIN subreddits s ON s.id = p.subreddit_id
       LEFT JOIN votes v
         ON v.target_type = 'post' AND v.target_id = p.id AND v.user_id = ?
       WHERE ua.user_id = ?
         AND p.is_removed = 0 AND p.is_shadow_hidden = 0
         AND p.author_id != ?
         AND p.id NOT IN (SELECT post_id FROM hidden_posts WHERE user_id = ?)
         AND p.author_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ?)
       ORDER BY ua.score DESC, p.score DESC, p.created_at DESC
       LIMIT ?`
    )
    .bind(userId, userId, userId, userId, userId, limit)
    .all();

  if (results && results.length > 0) {
    return results.map((row) =>
      mapFeedRow(row as Parameters<typeof mapFeedRow>[0], userId)
    );
  }

  const fallback = await db
    .prepare(
      `SELECT
         p.id, p.title, p.body, p.url, p.media_key,
         p.upvotes, p.downvotes, p.score, p.comment_count, p.created_at,
         p.source_lang, p.title_translated, p.body_translated, p.translation_status,
         p.translation_target_lang,
         u.id AS author_id, u.username AS author_username,
         u.name AS author_display_name,
         u.image AS author_image,
         ${AUTHOR_TAG_SELECT},
         s.id AS subreddit_id, s.name AS subreddit_name, s.title AS subreddit_title,
         v.value AS viewer_vote
       FROM posts p
       INNER JOIN "user" u ON u.id = p.author_id
       INNER JOIN subreddits s ON s.id = p.subreddit_id
       LEFT JOIN votes v
         ON v.target_type = 'post' AND v.target_id = p.id AND v.user_id = ?
       WHERE p.is_removed = 0 AND p.is_shadow_hidden = 0
         AND p.id NOT IN (SELECT post_id FROM hidden_posts WHERE user_id = ?)
         AND p.author_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ?)
       ORDER BY p.score DESC, p.created_at DESC
       LIMIT ?`
    )
    .bind(userId, userId, userId, limit)
    .all();

  return (fallback.results ?? []).map((row) =>
    mapFeedRow(row as Parameters<typeof mapFeedRow>[0], userId)
  );
}

export interface ProfileComment {
  id: string;
  postId: string;
  postTitle: string;
  body: string;
  score: number;
  createdAt: string;
  subreddit: {
    id: string;
    name: string;
  };
}

/** Recent comments by a user for profile tabs. */
export async function listUserComments(
  authorId: string,
  limit = 30
): Promise<ProfileComment[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT
         c.id,
         c.post_id,
         c.body,
         c.score,
         c.created_at,
         c.is_deleted,
         p.title AS post_title,
         s.id AS subreddit_id,
         s.name AS subreddit_name
       FROM comments c
       INNER JOIN posts p ON p.id = c.post_id
       INNER JOIN subreddits s ON s.id = p.subreddit_id
       WHERE c.author_id = ?
         AND c.is_removed = 0
         AND c.is_shadow_hidden = 0
         AND p.is_removed = 0
       ORDER BY c.created_at DESC
       LIMIT ?`
    )
    .bind(authorId, limit)
    .all<{
      id: string;
      post_id: string;
      body: string;
      score: number;
      created_at: string;
      is_deleted: number;
      post_title: string;
      subreddit_id: string;
      subreddit_name: string;
    }>();

  return (results ?? []).map((row) => ({
    id: row.id,
    postId: row.post_id,
    postTitle: row.post_title,
    body: row.is_deleted ? "[deleted]" : row.body,
    score: displayScore(row.score),
    createdAt: row.created_at,
    subreddit: {
      id: row.subreddit_id,
      name: row.subreddit_name,
    },
  }));
}
