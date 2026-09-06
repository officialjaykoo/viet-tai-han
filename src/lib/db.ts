import { getCloudflareContext } from "@opennextjs/cloudflare";

import type {
  ContentSourceLang,
  ContentTranslation,
  ContentTranslationStatus,
  FeedPost,
  OrganicFeedPage,
  ViewerVote,
} from "@/lib/types";
import { resolveAccountTags } from "@/lib/tags";
import { personalizedDisplayScore } from "@/lib/vote-weight";
import {
  InvalidFeedCursorError,
  openFeedCursor,
  signFeedCursor,
} from "@/lib/security/feed-cursor";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export type FeedSort = "hot" | "new" | "top";
export type FeedMode = "home" | "popular" | "community";

export async function getDb(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

export async function getEnv(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}

function voteValueToAction(value: number | null | undefined): ViewerVote {
  if (value === 1) return "upvote";
  if (value === -1) return "downvote";
  return null;
}

function mapTranslation(row: {
  source_lang?: string | null;
  translation_target_lang?: string | null;
  translation_status?: string | null;
  title_translated?: string | null;
  body_translated?: string | null;
}): ContentTranslation | null {
  const status = (row.translation_status ?? "pending") as ContentTranslationStatus;
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

interface FeedQueryRow {
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
  source_lang: string | null;
  translation_target_lang: string | null;
  title_translated: string | null;
  body_translated: string | null;
  translation_status: string | null;
  author_id: string;
  author_username: string;
  author_display_name: string | null;
  author_image: string | null;
  author_role: string | null;
  author_is_nsfw: number | null;
  author_created_at: string | null;
  author_karma: number | null;
  author_is_community_mod: number | null;
  author_has_veteran: number | null;
  subreddit_id: string;
  subreddit_name: string;
  subreddit_title: string;
  viewer_vote: number | null;
  viewer_vote_weight: number | null;
}

function mapFeedPost(row: FeedQueryRow, viewerUserId?: string | null): FeedPost {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    url: row.url,
    mediaKey: row.media_key,
    score:
      row.viewer_vote == null
        ? personalizedDisplayScore(row.score, null)
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
    subreddit: {
      id: row.subreddit_id,
      name: row.subreddit_name,
      title: row.subreddit_title,
    },
  };
}

function orderClause(sort: FeedSort): string {
  switch (sort) {
    case "top":
      return `ORDER BY p.score DESC, p.created_at DESC, p.id DESC`;
    case "hot":
      return `ORDER BY p.hot_score DESC, p.created_at DESC, p.id DESC`;
    case "new":
    default:
      return `ORDER BY p.created_at DESC, p.id DESC`;
  }
}


export async function getFeedPosts(options: {
  limit?: number;
  cursor?: string | null;
  subreddit?: string | null;
  authorId?: string | null;
  viewerUserId?: string | null;
  sort?: FeedSort;
  mode?: FeedMode;
}): Promise<OrganicFeedPage> {
  const db = await getDb();
  const limit = Math.min(
    Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  );
  const sort = options.sort ?? "hot";
  const mode = options.mode ?? (options.subreddit ? "community" : "popular");
  const viewerUserId = options.viewerUserId ?? null;
  const subreddit = options.subreddit ?? null;
  const authorId = options.authorId ?? null;
  const cursorContext = {
    sort,
    mode,
    subreddit,
    authorId,
    viewerId: viewerUserId,
  };
  const cursor = await openFeedCursor(options.cursor ?? null, cursorContext);

  const params: Array<string | number> = [];
  const where: string[] = [`p.is_removed = 0`, `p.is_shadow_hidden = 0`];

  if (viewerUserId) {
    params.push(viewerUserId);
    where.push(
      `p.id NOT IN (SELECT post_id FROM hidden_posts WHERE user_id = ?)`
    );
    params.push(viewerUserId);
    where.push(
      `p.author_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ?)`
    );
    params.push(viewerUserId);
  }

  if (authorId) {
    where.push(`p.author_id = ?`);
    params.push(authorId);
  }

  if (subreddit) {
    where.push(`s.name = ?`);
    params.push(subreddit);
  } else if (mode === "home" && viewerUserId && !authorId) {
    where.push(
      `p.subreddit_id IN (SELECT subreddit_id FROM subscriptions WHERE user_id = ?)`
    );
    params.push(viewerUserId);
  }

  // Cursor pagination is sort-aware for new/top; hot falls back to created_at keyset
  if (cursor) {
    if (sort === "top" && cursor.score != null) {
      where.push(
        `(p.score < ? OR (p.score = ? AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))))`
      );
      params.push(
        cursor.score,
        cursor.score,
        cursor.createdAt,
        cursor.createdAt,
        cursor.id
      );
    } else {
      where.push(`(p.created_at < ? OR (p.created_at = ? AND p.id < ?))`);
      params.push(cursor.createdAt, cursor.createdAt, cursor.id);
    }
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const voteSelect = viewerUserId
    ? `v.value AS viewer_vote, v.weight AS viewer_vote_weight`
    : `NULL AS viewer_vote, NULL AS viewer_vote_weight`;
  const voteJoin = viewerUserId
    ? `LEFT JOIN votes v
         ON v.target_type = 'post'
        AND v.target_id = p.id
        AND v.user_id = ?`
    : "";

  const statement = db
    .prepare(
      `SELECT
         p.id,
         p.title,
         p.body,
         p.url,
         p.media_key,
         p.upvotes,
         p.downvotes,
         p.score,
         p.comment_count,
         p.created_at,
         p.source_lang,
         p.translation_target_lang,
         p.title_translated,
         p.body_translated,
         p.translation_status,
         u.id AS author_id,
         u.username AS author_username,
         u.name AS author_display_name,
         u.image AS author_image,
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
         ) AS author_has_veteran,
         s.id AS subreddit_id,
         s.name AS subreddit_name,
         s.title AS subreddit_title,
         ${voteSelect}
       FROM posts p
       INNER JOIN "user" u ON u.id = p.author_id
       INNER JOIN subreddits s ON s.id = p.subreddit_id
       ${voteJoin}
       ${whereSql}
       ${orderClause(sort)}
       LIMIT ?`
    )
    .bind(...params, limit + 1);

  const { results } = await statement.all<FeedQueryRow>();
  const rows = results ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  return {
    posts: page.map((row) => mapFeedPost(row, viewerUserId)),
    nextCursor:
      hasMore && last
        ? await signFeedCursor(
            {
              createdAt: last.created_at,
              id: last.id,
              score: last.score,
            },
            cursorContext
          )
        : null,
    hasMore,
  };
}

export { InvalidFeedCursorError };
