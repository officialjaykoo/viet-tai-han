import { getDb } from "@/lib/db";
import { resolveAccountTags, type AccountTag } from "@/lib/tags";
import { displayScore } from "@/lib/vote-weight";

const MAX_QUERY_LENGTH = 80;
const DEFAULT_LIMIT = 8;

export type SearchCommunityHit = {
  name: string;
  title: string;
  subscriberCount: number;
};

export type SearchAccountHit = {
  username: string;
  displayName: string | null;
  image: string | null;
  karma: number;
  tags: AccountTag[];
};

export type SearchPostHit = {
  id: string;
  title: string;
  body: string | null;
  score: number;
  commentCount: number;
  createdAt: string;
  authorUsername: string;
  subredditName: string;
};

export type SearchResults = {
  query: string;
  communities: SearchCommunityHit[];
  accounts: SearchAccountHit[];
  posts: SearchPostHit[];
};

export function normalizeSearchQuery(raw: string): string {
  return raw.trim().slice(0, MAX_QUERY_LENGTH);
}

/** Escape LIKE wildcards and wrap with %. */
export function likeContains(query: string): string {
  const escaped = query.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${escaped}%`;
}

export async function searchAll(
  rawQuery: string,
  limits: {
    communities?: number;
    accounts?: number;
    posts?: number;
  } = {}
): Promise<SearchResults> {
  const query = normalizeSearchQuery(rawQuery);
  if (query.length < 1) {
    return { query, communities: [], accounts: [], posts: [] };
  }

  const communityLimit = limits.communities ?? DEFAULT_LIMIT;
  const accountLimit = limits.accounts ?? DEFAULT_LIMIT;
  const postLimit = limits.posts ?? 12;
  const pattern = likeContains(query);
  const db = await getDb();

  const [communities, accounts, posts] = await Promise.all([
    searchCommunities(pattern, communityLimit),
    searchAccounts(pattern, accountLimit),
    searchPosts(pattern, postLimit),
  ]);

  return { query, communities, accounts, posts };
}

async function searchCommunities(
  pattern: string,
  limit: number
): Promise<SearchCommunityHit[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT name, title, subscriber_count
       FROM subreddits
       WHERE is_removed = 0
         AND (name LIKE ? ESCAPE '\\' OR title LIKE ? ESCAPE '\\'
              OR IFNULL(description, '') LIKE ? ESCAPE '\\')
       ORDER BY subscriber_count DESC, name ASC
       LIMIT ?`
    )
    .bind(pattern, pattern, pattern, limit)
    .all<{
      name: string;
      title: string;
      subscriber_count: number;
    }>();

  return (results ?? []).map((row) => ({
    name: row.name,
    title: row.title,
    subscriberCount: Number(row.subscriber_count ?? 0),
  }));
}

async function searchAccounts(
  pattern: string,
  limit: number
): Promise<SearchAccountHit[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT
         username, name, image, karma, role, isNsfw, createdAt,
         EXISTS (
           SELECT 1 FROM user_achievements ua
           INNER JOIN achievements a ON a.id = ua.achievement_id
           WHERE ua.user_id = "user".id AND a.slug = 'veteran'
         ) AS has_veteran,
         EXISTS (
           SELECT 1 FROM subreddit_moderators WHERE user_id = "user".id
         ) AS is_community_mod
       FROM "user"
       WHERE status = 'active'
         AND username IS NOT NULL
         AND (username LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\')
       ORDER BY karma DESC, username ASC
       LIMIT ?`
    )
    .bind(pattern, pattern, limit)
    .all<{
      username: string;
      name: string;
      image: string | null;
      karma: number;
      role: string;
      isNsfw: number;
      createdAt: string;
      has_veteran: number;
      is_community_mod: number;
    }>();

  return (results ?? []).map((row) => ({
    username: row.username,
    displayName: row.name || null,
    image: row.image,
    karma: Number(row.karma ?? 0),
    tags: resolveAccountTags({
      role: row.role,
      isNsfw: row.isNsfw,
      createdAt: row.createdAt,
      karma: row.karma,
      isCommunityMod: Boolean(row.is_community_mod),
      hasVeteranAchievement: Boolean(row.has_veteran),
    }),
  }));
}

async function searchPosts(
  pattern: string,
  limit: number
): Promise<SearchPostHit[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT
         p.id, p.title, p.body, p.score, p.comment_count, p.created_at,
         u.username AS author_username,
         s.name AS subreddit_name
       FROM posts p
       INNER JOIN "user" u ON u.id = p.author_id
       INNER JOIN subreddits s ON s.id = p.subreddit_id
       WHERE p.is_removed = 0
         AND p.is_shadow_hidden = 0
         AND (p.title LIKE ? ESCAPE '\\'
              OR IFNULL(p.body, '') LIKE ? ESCAPE '\\')
       ORDER BY p.score DESC, p.created_at DESC
       LIMIT ?`
    )
    .bind(pattern, pattern, limit)
    .all<{
      id: string;
      title: string;
      body: string | null;
      score: number;
      comment_count: number;
      created_at: string;
      author_username: string;
      subreddit_name: string;
    }>();

  return (results ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    score: displayScore(Number(row.score ?? 0)),
    commentCount: Number(row.comment_count ?? 0),
    createdAt: row.created_at,
    authorUsername: row.author_username,
    subredditName: row.subreddit_name,
  }));
}

/** Lightweight community lookup for the compose community picker. */
export async function searchCommunitiesQuery(
  rawQuery: string,
  limit = 12
): Promise<SearchCommunityHit[]> {
  const query = normalizeSearchQuery(rawQuery);
  if (query.length < 1) {
    const db = await getDb();
    const { results } = await db
      .prepare(
        `SELECT name, title, subscriber_count
         FROM subreddits
         WHERE is_removed = 0
         ORDER BY subscriber_count DESC, name ASC
         LIMIT ?`
      )
      .bind(limit)
      .all<{ name: string; title: string; subscriber_count: number }>();
    return (results ?? []).map((row) => ({
      name: row.name,
      title: row.title,
      subscriberCount: Number(row.subscriber_count ?? 0),
    }));
  }
  return searchCommunities(likeContains(query), limit);
}
