import { getDb } from "@/lib/db";
import {
  parseDiscoverySource,
  type DiscoverySource,
} from "@/lib/vote-weight";
import { displayScore } from "@/lib/vote-weight";
import { AuthError } from "@/lib/session";

function dayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function recordPostView(input: {
  postId: string;
  viewerId?: string | null;
  sessionKey: string;
  discoverySource?: string | null;
  referrerHost?: string | null;
}) {
  const db = await getDb();
  const post = await db
    .prepare(`SELECT id FROM posts WHERE id = ? AND is_removed = 0`)
    .bind(input.postId)
    .first();
  if (!post) return { recorded: false };

  const source = parseDiscoverySource(input.discoverySource);
  const key = input.sessionKey.slice(0, 64) || crypto.randomUUID();

  try {
    await db
      .prepare(
        `INSERT INTO post_views (
           id, post_id, viewer_id, session_key, discovery_source, referrer_host, day_key
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        input.postId,
        input.viewerId ?? null,
        key,
        source,
        input.referrerHost?.slice(0, 120) ?? null,
        dayKey()
      )
      .run();
    return { recorded: true };
  } catch {
    return { recorded: false };
  }
}

export async function recordPostLinkClick(input: {
  postId: string;
  viewerId?: string | null;
  sessionKey?: string | null;
}): Promise<string | null> {
  const db = await getDb();
  const post = await db
    .prepare(`SELECT url FROM posts WHERE id = ? AND is_removed = 0`)
    .bind(input.postId)
    .first<{ url: string | null }>();
  if (!post?.url) return null;

  await db
    .prepare(
      `INSERT INTO post_link_clicks (id, post_id, viewer_id, session_key)
       VALUES (?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      input.postId,
      input.viewerId ?? null,
      input.sessionKey?.slice(0, 64) ?? null
    )
    .run();

  return post.url;
}

export async function getPostAnalytics(input: {
  postId: string;
  authorId: string;
  range: "7d" | "30d" | "all";
}) {
  const db = await getDb();
  const post = await db
    .prepare(
      `SELECT id, author_id, title, url, score, comment_count, upvotes, downvotes, created_at
       FROM posts WHERE id = ? AND is_removed = 0`
    )
    .bind(input.postId)
    .first<{
      id: string;
      author_id: string;
      title: string;
      url: string | null;
      score: number;
      comment_count: number;
      upvotes: number;
      downvotes: number;
      created_at: string;
    }>();

  if (!post) throw new AuthError("Post not found", 404);
  if (post.author_id !== input.authorId) {
    throw new AuthError("Only the author can view analytics", 403);
  }

  let sinceSql = "";
  const binds: string[] = [input.postId];
  if (input.range === "7d") {
    sinceSql = ` AND created_at >= ?`;
    binds.push(new Date(Date.now() - 7 * 86400_000).toISOString());
  } else if (input.range === "30d") {
    sinceSql = ` AND created_at >= ?`;
    binds.push(new Date(Date.now() - 30 * 86400_000).toISOString());
  }

  const totals = await db
    .prepare(
      `SELECT
         COUNT(*) AS views,
         COUNT(DISTINCT COALESCE(viewer_id, session_key)) AS uniques
       FROM post_views
       WHERE post_id = ?${sinceSql}`
    )
    .bind(...binds)
    .first<{ views: number; uniques: number }>();

  const { results: bySource } = await db
    .prepare(
      `SELECT discovery_source AS source, COUNT(*) AS views
       FROM post_views
       WHERE post_id = ?${sinceSql}
       GROUP BY discovery_source
       ORDER BY views DESC`
    )
    .bind(...binds)
    .all<{ source: DiscoverySource; views: number }>();

  const { results: byReferrer } = await db
    .prepare(
      `SELECT COALESCE(NULLIF(referrer_host, ''), '(direct)') AS host, COUNT(*) AS views
       FROM post_views
       WHERE post_id = ?${sinceSql}
       GROUP BY host
       ORDER BY views DESC
       LIMIT 15`
    )
    .bind(...binds)
    .all<{ host: string; views: number }>();

  // Hourly buckets — last 48h for 7d/all short charts; for 30d use daily instead via hour truncation still ok but denser
  const hourlySince =
    input.range === "30d"
      ? new Date(Date.now() - 30 * 86400_000).toISOString()
      : input.range === "all"
        ? new Date(Date.now() - 7 * 86400_000).toISOString() // chart window capped at 7d for readability
        : new Date(Date.now() - 7 * 86400_000).toISOString();

  const { results: hourly } = await db
    .prepare(
      `SELECT
         strftime('%Y-%m-%dT%H:00:00Z', created_at) AS hour,
         COUNT(*) AS views
       FROM post_views
       WHERE post_id = ? AND created_at >= ?
       GROUP BY hour
       ORDER BY hour ASC`
    )
    .bind(input.postId, hourlySince)
    .all<{ hour: string; views: number }>();

  const linkClicks = await db
    .prepare(
      `SELECT COUNT(*) AS c FROM post_link_clicks
       WHERE post_id = ?${sinceSql.replace(/created_at/g, "created_at")}`
    )
    .bind(...binds)
    .first<{ c: number }>();

  const views = Number(totals?.views ?? 0);
  const clicks = Number(linkClicks?.c ?? 0);
  const linkCtr =
    post.url && views > 0
      ? Math.round((clicks / views) * 10000) / 100
      : null;

  return {
    postId: post.id,
    title: post.title,
    hasLink: Boolean(post.url),
    score: displayScore(post.score),
    commentCount: post.comment_count,
    /** Author-only vote counts (not shown publicly). */
    upvotes: post.upvotes,
    downvotes: post.downvotes,
    createdAt: post.created_at,
    range: input.range,
    views,
    uniqueViewers: Number(totals?.uniques ?? 0),
    linkClicks: post.url ? clicks : null,
    linkCtr,
    bySource: (bySource ?? []).map((row) => ({
      source: row.source,
      views: Number(row.views),
    })),
    byReferrer: (byReferrer ?? []).map((row) => ({
      host: row.host,
      views: Number(row.views),
    })),
    hourly: (hourly ?? []).map((row) => ({
      hour: row.hour,
      views: Number(row.views),
    })),
    chartWindow: "7d" as const,
  };
}
