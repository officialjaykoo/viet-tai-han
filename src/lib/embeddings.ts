import { getDb, getEnv } from "@/lib/db";

export const EMBEDDING_MODEL = "@cf/google/embeddinggemma-300m";
export const EMBEDDING_DIMENSIONS = 768;
export const EMBEDDING_VERSION = "embeddinggemma-300m-v1";

type EmbeddingResponse = {
  shape: number[];
  data: number[][];
};

function truncate(text: string, max = 1500): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max);
}

export function postEmbeddingText(input: {
  subredditName?: string | null;
  title: string;
  body?: string | null;
}): string {
  const parts = [
    input.subredditName ? `Community: ${input.subredditName}` : null,
    input.title.trim(),
    input.body?.trim() || null,
  ].filter(Boolean);
  return truncate(parts.join("\n"));
}

function averageVectors(vectors: number[][]): number[] {
  const dim = vectors[0]?.length ?? 0;
  if (
    !dim ||
    vectors.length === 0 ||
    vectors.some(
      (vector) =>
        vector.length !== dim || vector.some((value) => !Number.isFinite(value))
    )
  ) {
    return [];
  }

  const out = new Array<number>(dim).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < dim; i++) {
      out[i]! += vector[i]!;
    }
  }
  const n = vectors.length;
  for (let i = 0; i < dim; i++) {
    out[i]! /= n;
  }
  const norm =
    Math.sqrt(out.reduce((sum, value) => sum + value * value, 0)) || 1;
  return out.map((value) => value / norm);
}

async function getAiBindings() {
  try {
    const env = await getEnv();
    // Bindings may be missing in local next-dev without remote proxies.
    if (!("AI" in env) || !("VECTORIZE" in env) || !env.AI || !env.VECTORIZE) {
      return null;
    }
    return { ai: env.AI, vectorize: env.VECTORIZE };
  } catch (error) {
    console.warn("AI/Vectorize bindings unavailable", error);
    return null;
  }
}

export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (texts.length === 0) return [];
  const bindings = await getAiBindings();
  if (!bindings) return null;

  try {
    const response = (await bindings.ai.run(EMBEDDING_MODEL, {
      text: texts,
    })) as EmbeddingResponse;

    if (
      !response?.data?.length ||
      response.data.length !== texts.length ||
      response.data.some(
        (vector) =>
          vector.length !== EMBEDDING_DIMENSIONS ||
          vector.some((value) => !Number.isFinite(value))
      )
    ) {
      return null;
    }
    return response.data;
  } catch (error) {
    console.warn("Workers AI embedding failed", error);
    return null;
  }
}

export async function indexPostEmbedding(input: {
  postId: string;
  authorId: string;
  subredditId: string;
  subredditName: string;
  title: string;
  body?: string | null;
  createdAt?: string;
}): Promise<boolean> {
  const bindings = await getAiBindings();
  if (!bindings) return false;

  const text = postEmbeddingText(input);
  const vectors = await embedTexts([text]);
  if (!vectors?.[0]) return false;

  try {
    await bindings.vectorize.upsert([
      {
        id: input.postId,
        values: vectors[0],
        metadata: {
          authorId: input.authorId,
          subredditId: input.subredditId,
          subredditName: input.subredditName,
          createdAt: input.createdAt ?? new Date().toISOString(),
          embeddingModel: EMBEDDING_MODEL,
          embeddingVersion: EMBEDDING_VERSION,
        },
      },
    ]);
    return true;
  } catch (error) {
    console.warn("Vectorize upsert failed", error);
    return false;
  }
}

export async function removePostEmbedding(postId: string) {
  const bindings = await getAiBindings();
  if (!bindings) return;
  try {
    await bindings.vectorize.deleteByIds([postId]);
  } catch (error) {
    console.warn("Vectorize delete failed", error);
  }
}

async function buildUserPreferenceVector(userId: string): Promise<number[] | null> {
  const db = await getDb();

  // Prefer posts the user upvoted recently — strongest interest signal.
  const { results: liked } = await db
    .prepare(
      `SELECT p.id, p.title, p.body, s.name AS subreddit_name
       FROM votes v
       INNER JOIN posts p ON p.id = v.target_id
       INNER JOIN subreddits s ON s.id = p.subreddit_id
       WHERE v.user_id = ?
         AND v.target_type = 'post'
         AND v.value = 1
         AND p.is_removed = 0
         AND p.is_shadow_hidden = 0
       ORDER BY v.updated_at DESC
       LIMIT 12`
    )
    .bind(userId)
    .all<{
      id: string;
      title: string;
      body: string | null;
      subreddit_name: string;
    }>();
  const likedRows = liked ?? [];

  if (likedRows.length > 0) {
    // Re-embed the preference text instead of reading stored vectors. This
    // keeps old BGE vectors out of the new multilingual embedding space.
    const vectors = await embedTexts(
      likedRows.map((row) =>
        postEmbeddingText({
          subredditName: row.subreddit_name,
          title: row.title,
          body: row.body,
        })
      )
    );
    if (vectors?.length) return averageVectors(vectors);
  }

  // Cold start: communities they joined / are active in.
  const { results: communities } = await db
    .prepare(
      `SELECT DISTINCT s.name, s.title, s.description
       FROM subscriptions sub
       INNER JOIN subreddits s ON s.id = sub.subreddit_id
       WHERE sub.user_id = ?
       LIMIT 8`
    )
    .bind(userId)
    .all<{ name: string; title: string; description: string | null }>();

  const communityRows = communities ?? [];
  if (communityRows.length === 0) return null;

  const preferenceText = communityRows
    .map(
      (row) =>
        `Community ${row.name}: ${row.title}. ${row.description ?? ""}`
    )
    .join("\n");

  const vectors = await embedTexts([truncate(preferenceText)]);
  return vectors?.[0] ?? null;
}

/**
 * Semantic recommendations via Workers AI embeddings + Vectorize.
 * Returns ordered post IDs (most similar first), or null if unavailable.
 */
export async function queryRecommendedPostIds(
  userId: string,
  limit = 20
): Promise<string[] | null> {
  const bindings = await getAiBindings();
  if (!bindings) return null;

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const preference = await buildUserPreferenceVector(userId);
  if (!preference?.length) return null;

  try {
    const matches = await bindings.vectorize.query(preference, {
      topK: Math.min(safeLimit * 3, 50),
      returnMetadata: "indexed",
      filter: {
        embeddingVersion: EMBEDDING_VERSION,
        authorId: { $ne: userId },
      },
    });

    const ids = (matches.matches ?? [])
      .filter((match) => (match.score ?? 0) > 0.35)
      .map((match) => match.id)
      .filter(Boolean);

    return ids.length > 0 ? ids.slice(0, safeLimit) : null;
  } catch (error) {
    console.warn("Vectorize query failed", error);
    return null;
  }
}

/** Backfill embeddings for recent posts (admin / ops). */
export async function backfillPostEmbeddings(limit = 100): Promise<{
  indexed: number;
  failed: number;
}> {
  const db = await getDb();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const { results } = await db
    .prepare(
      `SELECT p.id, p.author_id, p.subreddit_id, p.title, p.body, p.created_at,
              s.name AS subreddit_name
       FROM posts p
       INNER JOIN subreddits s ON s.id = p.subreddit_id
       WHERE p.is_removed = 0 AND p.is_shadow_hidden = 0
       ORDER BY p.created_at DESC
       LIMIT ?`
    )
    .bind(safeLimit)
    .all<{
      id: string;
      author_id: string;
      subreddit_id: string;
      title: string;
      body: string | null;
      created_at: string;
      subreddit_name: string;
    }>();

  let indexed = 0;
  let failed = 0;
  for (const row of results ?? []) {
    const ok = await indexPostEmbedding({
      postId: row.id,
      authorId: row.author_id,
      subredditId: row.subreddit_id,
      subredditName: row.subreddit_name,
      title: row.title,
      body: row.body,
      createdAt: row.created_at,
    });
    if (ok) indexed += 1;
    else failed += 1;
  }
  return { indexed, failed };
}
