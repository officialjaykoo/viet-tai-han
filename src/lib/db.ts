import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { OrganicFeedPage } from "@/lib/types";
import { mapPostProjection, type PostProjectionRow } from "@/lib/post-projection";
import { publicPostVisibilitySql } from "@/lib/content-visibility";
import {
  InvalidFeedCursorError,
  openFeedCursor,
  signFeedCursor,
} from "@/lib/security/feed-cursor";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export type FeedSort = "new" | "popular";
export type FeedMode = "home" | "popular" | "community";

export async function getDb(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

export async function getEnv(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}

type FeedQueryRow = PostProjectionRow & {
  engagement_rank?: number;
};

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
  const mode = options.mode ?? (options.subreddit ? "community" : "popular");
  const sort = options.sort ?? (mode === "popular" ? "popular" : "new");
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
  const engagementRank = "p.like_count + (p.comment_count * 3)";

  const params: Array<string | number> = [];
  const where: string[] = [publicPostVisibilitySql()];

  const viewerLikeSelect = viewerUserId
    ? `EXISTS (
         SELECT 1 FROM post_likes pl
         WHERE pl.post_id = p.id AND pl.user_id = ?
       ) AS viewer_liked`
    : "0 AS viewer_liked";
  if (viewerUserId) params.push(viewerUserId);

  if (viewerUserId) {
    where.push(
      "p.id NOT IN (SELECT post_id FROM hidden_posts WHERE user_id = ?)"
    );
    params.push(viewerUserId);
    where.push(
      "p.author_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ?)"
    );
    params.push(viewerUserId);
  }

  if (authorId) {
    where.push("p.author_id = ?");
    params.push(authorId);
  }

  if (subreddit) {
    where.push("s.name = ?");
    params.push(subreddit);
  } else if (mode === "home" && viewerUserId && !authorId) {
    where.push(
      "p.subreddit_id IN (SELECT subreddit_id FROM subscriptions WHERE user_id = ?)"
    );
    params.push(viewerUserId);
  }

  if (cursor) {
    if (sort === "popular") {
      if (cursor.rank === undefined) {
        throw new InvalidFeedCursorError("Popular cursor is missing rank");
      }
      where.push(
        `(${engagementRank} < ? OR (${engagementRank} = ? AND
          (p.created_at < ? OR (p.created_at = ? AND p.id < ?))))`
      );
      params.push(
        cursor.rank,
        cursor.rank,
        cursor.createdAt,
        cursor.createdAt,
        cursor.id
      );
    } else {
      where.push("(p.created_at < ? OR (p.created_at = ? AND p.id < ?))");
      params.push(cursor.createdAt, cursor.createdAt, cursor.id);
    }
  }
  const statement = db
    .prepare(
      `SELECT
         p.id,
         p.title,
         p.body,
         p.url,
         p.media_key,
         p.like_count,
         p.comment_count,
         ${engagementRank} AS engagement_rank,
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
         ${viewerLikeSelect}
       FROM posts p
       INNER JOIN "user" u ON u.id = p.author_id
       INNER JOIN subreddits s ON s.id = p.subreddit_id
       WHERE ${where.join(" AND ")}
       ORDER BY ${
         sort === "popular" ? `${engagementRank} DESC,` : ""
       } p.created_at DESC, p.id DESC
       LIMIT ?`
    )
    .bind(...params, limit + 1);

  const { results } = await statement.all<FeedQueryRow>();
  const rows = results ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  return {
    posts: page.map((row) => mapPostProjection(row, viewerUserId)),
    nextCursor:
      hasMore && last
        ? await signFeedCursor(
            {
              rank:
                sort === "popular"
                  ? Number(last.engagement_rank ?? 0)
                  : undefined,
              createdAt: last.created_at,
              id: last.id,
            },
            cursorContext
          )
        : null,
    hasMore,
  };
}

export { InvalidFeedCursorError };
