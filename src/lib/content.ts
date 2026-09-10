import { getDb } from "@/lib/db";
import { openFeedCursor, signFeedCursor } from "@/lib/security/feed-cursor";
import type { ContentTranslation, FeedPost, ViewerLike } from "@/lib/types";
import { resolveAccountTags, type AccountTag } from "@/lib/tags";
import {
  mapPostProjection,
  mapPostTranslation,
  type PostProjectionRow,
} from "@/lib/post-projection";
import { publicPostVisibilitySql } from "@/lib/content-visibility";

export interface CommentNode {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  likeCount: number;
  depth: number;
  createdAt: string;
  isDeleted: boolean;
  isRemoved: boolean;
  liked: ViewerLike;
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
  username: string | null;
  name: string;
  image: string | null;
  bio: string | null;
  bannerKey: string | null;
  createdAt: string;
  tags: AccountTag[];
}

/** Server-only profile record; moderation and identity fields never cross the DTO boundary. */
export interface ProfileRecord extends PublicProfile {
  id: string;
  status: string;
  role: string;
}


const AUTHOR_TAG_SELECT = `
  u.role AS author_role,
  EXISTS (
    SELECT 1 FROM subreddit_moderators sm
    WHERE sm.subreddit_id = p.subreddit_id AND sm.user_id = p.author_id
  ) AS author_is_community_mod`;

const COMMENT_AUTHOR_TAG_SELECT = `
  u.role AS author_role,
  EXISTS (
    SELECT 1 FROM subreddit_moderators sm
    INNER JOIN posts pmod ON pmod.subreddit_id = sm.subreddit_id
    WHERE pmod.id = c.post_id AND sm.user_id = c.author_id
  ) AS author_is_community_mod`;
export async function getSubredditByName(name: string) {
  const db = await getDb();
  return db
    .prepare(
      `SELECT id, name, title, description, subscriber_count, created_at, created_by, is_removed
       FROM subreddits WHERE name = ? COLLATE NOCASE AND is_removed = 0`
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
             p.like_count, p.comment_count, p.is_locked, p.created_at,
             p.source_lang, p.title_translated, p.body_translated,
             p.translation_status, p.translation_target_lang,
             u.id AS author_id, u.username AS author_username,
             u.name AS author_display_name,
             u.image AS author_image,
             ${AUTHOR_TAG_SELECT},
             s.id AS subreddit_id, s.name AS subreddit_name,
             s.title AS subreddit_title,
             EXISTS (
               SELECT 1 FROM post_likes pl
               WHERE pl.post_id = p.id AND pl.user_id = ?
             ) AS viewer_liked,
             EXISTS (
               SELECT 1 FROM post_saves ps
               WHERE ps.post_id = p.id AND ps.user_id = ?
             ) AS viewer_saved
           FROM posts p
           INNER JOIN "user" u ON u.id = p.author_id
           INNER JOIN subreddits s ON s.id = p.subreddit_id
           WHERE p.id = ? AND ${publicPostVisibilitySql()}`
        )
        .bind(viewerUserId, viewerUserId, postId)
        .first()
    : await db
        .prepare(
          `SELECT
             p.id, p.title, p.body, p.url, p.media_key,
             p.like_count, p.comment_count, p.is_locked, p.created_at,
             p.source_lang, p.title_translated, p.body_translated,
             p.translation_status, p.translation_target_lang,
             u.id AS author_id, u.username AS author_username,
             u.name AS author_display_name,
             u.image AS author_image,
             ${AUTHOR_TAG_SELECT},
             s.id AS subreddit_id, s.name AS subreddit_name,
             s.title AS subreddit_title,
             0 AS viewer_liked,
             0 AS viewer_saved
           FROM posts p
           INNER JOIN "user" u ON u.id = p.author_id
           INNER JOIN subreddits s ON s.id = p.subreddit_id
           WHERE p.id = ? AND ${publicPostVisibilitySql()}`
        )
        .bind(postId)
        .first();
 
  if (!post) return null;

  const { results } = viewerUserId
    ? await db
        .prepare(
          `SELECT
             c.id, c.post_id, c.parent_id, c.body, c.like_count,
             c.depth, c.created_at, c.is_deleted, c.is_removed,
             c.is_shadow_hidden,
             c.source_lang, c.body_translated, c.translation_status,
             c.translation_target_lang,
             u.id AS author_id, u.username AS author_username,
             u.name AS author_display_name,
             u.image AS author_image,
             ${COMMENT_AUTHOR_TAG_SELECT},
             EXISTS (
               SELECT 1 FROM comment_likes cl
               WHERE cl.comment_id = c.id AND cl.user_id = ?
             ) AS viewer_liked
           FROM comments c
           INNER JOIN "user" u ON u.id = c.author_id
           WHERE c.post_id = ?
             AND c.is_shadow_hidden = 0
             AND (
               (c.is_removed = 0 AND c.is_deleted = 0)
               OR EXISTS (
                 SELECT 1
                 FROM comments child
                 WHERE child.parent_id = c.id
                   AND child.is_removed = 0
                   AND child.is_shadow_hidden = 0
               )
             )
           ORDER BY c.created_at ASC, c.id ASC`
        )
        .bind(viewerUserId, postId)
        .all()
    : await db
        .prepare(
          `SELECT
             c.id, c.post_id, c.parent_id, c.body, c.like_count,
             c.depth, c.created_at, c.is_deleted, c.is_removed,
             c.is_shadow_hidden,
             c.source_lang, c.body_translated, c.translation_status,
             c.translation_target_lang,
             u.id AS author_id, u.username AS author_username,
             u.name AS author_display_name,
             u.image AS author_image,
             ${COMMENT_AUTHOR_TAG_SELECT},
             0 AS viewer_liked
           FROM comments c
           INNER JOIN "user" u ON u.id = c.author_id
           WHERE c.post_id = ?
             AND c.is_shadow_hidden = 0
             AND (
               (c.is_removed = 0 AND c.is_deleted = 0)
               OR EXISTS (
                 SELECT 1
                 FROM comments child
                 WHERE child.parent_id = c.id
                   AND child.is_removed = 0
                   AND child.is_shadow_hidden = 0
               )
             )
           ORDER BY c.created_at ASC, c.id ASC`
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
      like_count: number;
      depth: number;
      created_at: string;
      is_deleted: number;
      is_removed: number;
      is_shadow_hidden: number;
      source_lang: string | null;
      author_is_community_mod: number | null;
      translation_target_lang: string | null;
      body_translated: string | null;
      translation_status: string | null;
      author_id: string;
      author_username: string | null;
      author_display_name: string | null;
      author_image: string | null;
      author_role: string | null;
      viewer_liked: number | null;
    };
    if (row.is_shadow_hidden) continue;
    const node: CommentNode = {
      id: row.id,
      postId: row.post_id,
      parentId: row.parent_id,
      body: row.is_deleted
        ? "[deleted]"
        : row.is_removed
          ? "[removed]"
          : row.body,
      likeCount: Number(row.like_count ?? 0),
      depth: row.depth,
      createdAt: row.created_at,
      isDeleted: Boolean(row.is_deleted),
      isRemoved: Boolean(row.is_removed),
      liked: Boolean(row.viewer_liked),
      translation: row.is_deleted || row.is_removed
        ? null
        : mapPostTranslation({
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
          isCommunityMod: Boolean(row.author_is_community_mod),
        }),
        isAuthor: Boolean(viewerUserId && viewerUserId === row.author_id),
      },
      children: [],
    };
    nodes.set(node.id, node);
  }

  for (const node of nodes.values()) {
    if (node.parentId === null) {
      roots.push(node);
      continue;
    }

    const parent = nodes.get(node.parentId);
    if (parent) {
      parent.children.push(node);
      continue;
    }

    console.warn("comment_tree_orphan", {
      commentId: node.id,
      parentId: node.parentId,
      postId: node.postId,
    });
  }

  return {
    ...mapPostProjection(post as PostProjectionRow, viewerUserId),
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
  createdAt: string;
  status: string;
  role: string;
  is_community_mod: number;
};

const PUBLIC_PROFILE_SELECT = `
  SELECT u.id, u.username, u.name, u.image, u.bio, u.bannerKey,
         u.createdAt, u.status, u.role,
         EXISTS (
           SELECT 1 FROM subreddit_moderators
           WHERE user_id = u.id
         ) AS is_community_mod
`;

function mapProfileRecord(row: PublicProfileRow): ProfileRecord {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    image: row.image,
    bio: row.bio,
    bannerKey: row.bannerKey,
    createdAt: row.createdAt,
    status: row.status,
    role: row.role,
    tags: resolveAccountTags({
      role: row.role,
      isCommunityMod: Boolean(row.is_community_mod),
    }),
  };
}

export function toPublicProfile(profile: ProfileRecord): PublicProfile {
  return {
    username: profile.username,
    name: profile.name,
    image: profile.image,
    bio: profile.bio,
    bannerKey: profile.bannerKey,
    createdAt: profile.createdAt,
    tags: profile.tags,
  };
}

export type PublicProfileLookup = {
  profile: ProfileRecord;
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
    return { profile: mapProfileRecord(current), redirectUsername: null };
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
    profile: mapProfileRecord(historical),
    redirectUsername: historical.username,
  };
}

export async function getPublicProfile(
  identifier: string
): Promise<PublicProfile | null> {
  const lookup = await resolvePublicProfile(identifier);
  return lookup ? toPublicProfile(lookup.profile) : null;
}

export async function getRecommendations(userId: string, limit = 10) {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT
         p.id, p.title, p.body, p.url, p.media_key,
         p.like_count, p.comment_count, p.created_at,
         p.source_lang, p.title_translated, p.body_translated,
         p.translation_status, p.translation_target_lang,
         u.id AS author_id, u.username AS author_username,
         u.name AS author_display_name,
         u.image AS author_image,
         ${AUTHOR_TAG_SELECT},
         s.id AS subreddit_id, s.name AS subreddit_name,
         s.title AS subreddit_title,
         CASE WHEN ua.user_id IS NOT NULL THEN 1 ELSE 0 END AS activity_match,
         CASE WHEN uf.follower_id IS NOT NULL THEN 1 ELSE 0 END AS followed_author,
         EXISTS (
           SELECT 1 FROM post_likes pl
           WHERE pl.post_id = p.id AND pl.user_id = ?
         ) AS viewer_liked,
         EXISTS (
           SELECT 1 FROM post_saves ps
           WHERE ps.post_id = p.id AND ps.user_id = ?
         ) AS viewer_saved
       FROM posts p
       INNER JOIN "user" u ON u.id = p.author_id
       INNER JOIN subreddits s ON s.id = p.subreddit_id
       LEFT JOIN user_activity ua
         ON ua.subreddit_id = p.subreddit_id AND ua.user_id = ?
       LEFT JOIN user_follows uf
         ON uf.follower_id = ? AND uf.following_id = p.author_id
       WHERE ${publicPostVisibilitySql()}
         AND p.author_id != ?
         AND p.id NOT IN (SELECT post_id FROM hidden_posts WHERE user_id = ?)
         AND p.author_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ?)
         AND p.author_id NOT IN (
           SELECT muted_id FROM user_mutes WHERE muter_id = ?
         )
       ORDER BY activity_match DESC, followed_author DESC,
                p.created_at DESC, p.id DESC
       LIMIT ?`
    )
    .bind(userId, userId, userId, userId, userId, userId, userId, userId, limit)
    .all();

  return (results ?? []).map((row) =>
    mapPostProjection(row as PostProjectionRow, userId)
  );
}

export interface ProfileComment {
  id: string;
  postId: string;
  postTitle: string;
  body: string;
  likeCount: number;
  createdAt: string;
  subreddit: {
    id: string;
    name: string;
  };
}

export type ProfileCommentPage = {
  comments: ProfileComment[];
  nextCursor: string | null;
  hasMore: boolean;
};

export async function listUserCommentsPage(
  authorId: string,
  options: { limit?: number; cursor?: string | null } = {}
): Promise<ProfileCommentPage> {
  const db = await getDb();
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 50);
  const cursorContext = {
    sort: "new" as const,
    mode: "popular" as const,
    subreddit: null,
    authorId,
    viewerId: null,
    scope: "comments" as const,
  };
  const cursor = await openFeedCursor(options.cursor ?? null, cursorContext);
  const params: Array<string | number> = [authorId];
  const cursorClause = cursor
    ? " AND (c.created_at < ? OR (c.created_at = ? AND c.id < ?))"
    : "";
  if (cursor) {
    params.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }

  const { results } = await db
    .prepare(
      `SELECT
         c.id,
         c.post_id,
         c.body,
         c.like_count,
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
         AND c.is_deleted = 0
         AND c.is_shadow_hidden = 0
         AND ${publicPostVisibilitySql()}
         ${cursorClause}
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT ?`
    )
    .bind(...params, limit + 1)
    .all<{
      id: string;
      post_id: string;
      body: string;
      like_count: number;
      created_at: string;
      is_deleted: number;
      post_title: string;
      subreddit_id: string;
      subreddit_name: string;
    }>();

  const rows = results ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const comments = page.map((row) => ({
    id: row.id,
    postId: row.post_id,
    postTitle: row.post_title,
    body: row.is_deleted ? "[deleted]" : row.body,
    likeCount: Number(row.like_count ?? 0),
    createdAt: row.created_at,
    subreddit: {
      id: row.subreddit_id,
      name: row.subreddit_name,
    },
  }));
  const last = page.at(-1);
  return {
    comments,
    hasMore,
    nextCursor:
      hasMore && last
        ? await signFeedCursor(
            { createdAt: last.created_at, id: last.id },
            cursorContext
          )
        : null,
  };
}

/** Recent comments by a user for overview/profile callers. */
export async function listUserComments(
  authorId: string,
  limit = 30
): Promise<ProfileComment[]> {
  return (await listUserCommentsPage(authorId, { limit })).comments;
}
