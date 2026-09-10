import { getDb } from "@/lib/db";
import { publicPostVisibilitySql } from "@/lib/content-visibility";
import { resolveAccountTags, type AccountTag } from "@/lib/tags";

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
  tags: AccountTag[];
};

export type SearchPostHit = {
  id: string;
  title: string;
  body: string | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  authorUsername: string;
  subredditName: string;
};
export type SearchQuestionHit = {
  id: string;
  title: string;
  body: string;
  answerCount: number;
  acceptedAnswerId: string | null;
  createdAt: string;
  authorUsername: string;
  subredditName: string;
};
export type SearchListingHit = {
  id: string;
  kind: "market" | "job" | "service";
  category: string;
  title: string;
  body: string;
  price: string | null;
  location: string;
  status: "active" | "sold" | "closed";
  createdAt: string;
  authorUsername: string;
};

export type SearchResults = {
  query: string;
  communities: SearchCommunityHit[];
  accounts: SearchAccountHit[];
  posts: SearchPostHit[];
  questions: SearchQuestionHit[];
  listings: SearchListingHit[];
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
    questions?: number;
    listings?: number;
  } = {},
  viewerUserId?: string | null
): Promise<SearchResults> {
  const query = normalizeSearchQuery(rawQuery);
  if (query.length < 1) {
    return {
      query,
      communities: [],
      accounts: [],
      posts: [],
      questions: [],
      listings: [],
    };
  }

  const communityLimit = limits.communities ?? DEFAULT_LIMIT;
  const accountLimit = limits.accounts ?? DEFAULT_LIMIT;
  const postLimit = limits.posts ?? 12;
  const questionLimit = limits.questions ?? 12;
  const listingLimit = limits.listings ?? 12;
  const pattern = likeContains(query);
  const [communities, accounts, posts, questions, listings] = await Promise.all([
    searchCommunities(pattern, communityLimit),
    searchAccounts(pattern, accountLimit, viewerUserId),
    searchPosts(pattern, postLimit, viewerUserId),
    searchQuestions(pattern, questionLimit),
    searchListings(pattern, listingLimit),
  ]);

  return { query, communities, accounts, posts, questions, listings };
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
  limit: number,
  viewerUserId?: string | null
): Promise<SearchAccountHit[]> {
  const db = await getDb();
  const mutedClause = viewerUserId
    ? 'AND "user".id NOT IN (SELECT muted_id FROM user_mutes WHERE muter_id = ?)'
    : "";
  const { results } = await db
    .prepare(
      `SELECT
         username, name, image, role,
         EXISTS (
           SELECT 1 FROM subreddit_moderators WHERE user_id = "user".id
         ) AS is_community_mod
       FROM "user"
       WHERE status = 'active'
         AND username IS NOT NULL
         ${mutedClause}
         AND (username LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\')
       ORDER BY username ASC
       LIMIT ?`
    )
    .bind(
      ...(viewerUserId
        ? [viewerUserId, pattern, pattern, limit]
        : [pattern, pattern, limit])
    )
    .all<{
      username: string;
      name: string;
      image: string | null;
      role: string;
      is_community_mod: number;
    }>();

  return (results ?? []).map((row) => ({
    username: row.username,
    displayName: row.name || null,
    image: row.image,
    tags: resolveAccountTags({
      role: row.role,
      isCommunityMod: Boolean(row.is_community_mod),
    }),
  }));
}

async function searchPosts(
  pattern: string,
  limit: number,
  viewerUserId?: string | null
): Promise<SearchPostHit[]> {
  const db = await getDb();
  const mutedClause = viewerUserId
    ? "AND p.author_id NOT IN (SELECT muted_id FROM user_mutes WHERE muter_id = ?)"
    : "";
  const { results } = await db
    .prepare(
      `SELECT
         p.id, p.title, p.body, p.like_count, p.comment_count, p.created_at,
         u.username AS author_username,
         s.name AS subreddit_name
       FROM posts p
       INNER JOIN "user" u ON u.id = p.author_id
       INNER JOIN subreddits s ON s.id = p.subreddit_id
       WHERE ${publicPostVisibilitySql()}
         ${mutedClause}
         AND (p.title LIKE ? ESCAPE '\\'
              OR IFNULL(p.body, '') LIKE ? ESCAPE '\\')
       ORDER BY p.like_count DESC, p.created_at DESC
       LIMIT ?`
    )
    .bind(
      ...(viewerUserId
        ? [viewerUserId, pattern, pattern, limit]
        : [pattern, pattern, limit])
    )
    .all<{
      id: string;
      title: string;
      body: string | null;
      like_count: number;
      comment_count: number;
      created_at: string;
      author_username: string;
      subreddit_name: string;
    }>();

  return (results ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    likeCount: Number(row.like_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
    createdAt: row.created_at,
    authorUsername: row.author_username,
    subredditName: row.subreddit_name,
  }));
}
async function searchListings(
  pattern: string,
  limit: number
): Promise<SearchListingHit[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT
         l.id, l.kind, l.category, l.title, l.body, l.price, l.location,
         l.status, l.created_at,
         u.username AS author_username
       FROM listings l
       INNER JOIN "user" u ON u.id = l.seller_id
       WHERE l.status IN ('active', 'sold', 'closed')
         AND l.is_shadow_hidden = 0
         AND u.status = 'active'
         AND (l.title LIKE ? ESCAPE '\\'
              OR l.body LIKE ? ESCAPE '\\'
              OR l.category LIKE ? ESCAPE '\\'
              OR l.location LIKE ? ESCAPE '\\')
       ORDER BY l.status = 'active' DESC, l.created_at DESC, l.id DESC
       LIMIT ?`
    )
    .bind(pattern, pattern, pattern, pattern, limit)
    .all<{
      id: string;
      kind: "market" | "job" | "service";
      category: string;
      title: string;
      body: string;
      price: string | null;
      location: string;
      status: "active" | "sold" | "closed";
      created_at: string;
      author_username: string;
    }>();

  return (results ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    category: row.category,
    title: row.title,
    body: row.body,
    price: row.price,
    location: row.location,
    status: row.status,
    createdAt: row.created_at,
    authorUsername: row.author_username,
  }));
}
async function searchQuestions(
  pattern: string,
  limit: number
): Promise<SearchQuestionHit[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT
         q.id, q.title, q.body, q.answer_count, q.accepted_answer_id,
         q.created_at,
         COALESCE(u.username, u.name) AS author_username,
         s.name AS subreddit_name
       FROM questions q
       INNER JOIN "user" u ON u.id = q.author_id
       INNER JOIN subreddits s ON s.id = q.subreddit_id
       WHERE q.is_removed = 0
         AND q.is_shadow_hidden = 0
         AND s.is_removed = 0
         AND (q.title LIKE ? ESCAPE '\\'
              OR q.body LIKE ? ESCAPE '\\')
       ORDER BY (q.accepted_answer_id IS NOT NULL) DESC,
                q.updated_at DESC, q.id DESC
       LIMIT ?`
    )
    .bind(pattern, pattern, limit)
    .all<{
      id: string;
      title: string;
      body: string;
      answer_count: number;
      accepted_answer_id: string | null;
      created_at: string;
      author_username: string;
      subreddit_name: string;
    }>();

  return (results ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    answerCount: Number(row.answer_count ?? 0),
    acceptedAnswerId: row.accepted_answer_id,
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
