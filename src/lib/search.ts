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
  } = {}
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
    searchAccounts(pattern, accountLimit),
    searchPosts(pattern, postLimit),
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
