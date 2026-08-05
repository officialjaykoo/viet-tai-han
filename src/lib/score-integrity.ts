import { getDb } from "@/lib/db";
import {
  ageHoursSince,
  computeHotScore,
  effectiveVoteWeight,
  parseDiscoverySource,
  type DiscoverySource,
} from "@/lib/vote-weight";
import type { VoteAction } from "@/lib/types";

const VELOCITY_WINDOW_MINUTES = 10;
const LOW_KARMA_THRESHOLD = 20;

export async function getVoterIntegrityContext(input: {
  userId: string;
  targetType: "post" | "comment";
  targetId: string;
  action: VoteAction;
  voterKarma: number;
  /** For comments, discovery is weaker — treat as unknown browse. */
  postIdForDiscovery?: string;
}): Promise<{
  weight: number;
  discoverySource: DiscoverySource | null;
  hasPriorView: boolean;
}> {
  const db = await getDb();
  const windowStart = new Date(
    Date.now() - VELOCITY_WINDOW_MINUTES * 60_000
  ).toISOString();
  const value = input.action === "upvote" ? 1 : -1;

  const burst = await db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN voter_karma < ? THEN 1 ELSE 0 END) AS low_karma
       FROM vote_events
       WHERE target_type = ?
         AND target_id = ?
         AND value = ?
         AND created_at >= ?`
    )
    .bind(
      LOW_KARMA_THRESHOLD,
      input.targetType,
      input.targetId,
      value,
      windowStart
    )
    .first<{ total: number; low_karma: number | null }>();

  const recentSameDirection = Number(burst?.total ?? 0);
  const lowKarma = Number(burst?.low_karma ?? 0);
  const recentLowKarmaShare =
    recentSameDirection > 0 ? lowKarma / recentSameDirection : 0;

  const user = await db
    .prepare(`SELECT createdAt FROM "user" WHERE id = ?`)
    .bind(input.userId)
    .first<{ createdAt: string }>();
  const accountAgeHours = user ? ageHoursSince(user.createdAt) : 0;

  const otherVotes = await db
    .prepare(
      `SELECT COUNT(*) AS c FROM votes
       WHERE user_id = ?
         AND NOT (target_type = ? AND target_id = ?)`
    )
    .bind(input.userId, input.targetType, input.targetId)
    .first<{ c: number }>();

  let discoverySource: DiscoverySource | null = null;
  let hasPriorView = false;

  const discoveryPostId =
    input.targetType === "post"
      ? input.targetId
      : input.postIdForDiscovery ?? null;

  if (discoveryPostId) {
    const view = await db
      .prepare(
        `SELECT discovery_source FROM post_views
         WHERE post_id = ? AND viewer_id = ?
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .bind(discoveryPostId, input.userId)
      .first<{ discovery_source: string }>();
    if (view) {
      hasPriorView = true;
      discoverySource = parseDiscoverySource(view.discovery_source);
    }
  }

  const weight = effectiveVoteWeight({
    action: input.action,
    voterKarma: input.voterKarma,
    discoverySource,
    hasPriorView,
    recentSameDirection,
    recentLowKarmaShare,
    accountAgeHours,
    votesOnOtherTargets: Number(otherVotes?.c ?? 0),
  });

  return { weight, discoverySource, hasPriorView };
}

export async function recordVoteEvent(input: {
  targetType: "post" | "comment";
  targetId: string;
  userId: string;
  value: number;
  weight: number;
  voterKarma: number;
  discoverySource: DiscoverySource | null;
}) {
  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO vote_events (
         id, target_type, target_id, user_id, value, weight,
         voter_karma, discovery_source
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      input.targetType,
      input.targetId,
      input.userId,
      input.value,
      input.weight,
      input.voterKarma,
      input.discoverySource
    )
    .run();
}

export async function refreshPostHotScore(postId: string) {
  const db = await getDb();
  const row = await db
    .prepare(`SELECT score, created_at FROM posts WHERE id = ?`)
    .bind(postId)
    .first<{ score: number; created_at: string }>();
  if (!row) return;
  const hot = computeHotScore(row.score, ageHoursSince(row.created_at));
  await db
    .prepare(`UPDATE posts SET hot_score = ? WHERE id = ?`)
    .bind(hot, postId)
    .run();
}

/** Admin signal: posts with heavy recent same-direction vote bursts. */
export async function listBurstPosts(limit = 20) {
  const db = await getDb();
  const windowStart = new Date(Date.now() - 60 * 60_000).toISOString();
  const { results } = await db
    .prepare(
      `SELECT
         ve.target_id AS post_id,
         p.title,
         COUNT(*) AS events,
         SUM(CASE WHEN ve.voter_karma < ? THEN 1 ELSE 0 END) AS low_karma_events,
         SUM(CASE WHEN ve.discovery_source IN ('direct','shared','unknown')
                    OR ve.discovery_source IS NULL THEN 1 ELSE 0 END) AS weak_source_events
       FROM vote_events ve
       INNER JOIN posts p ON p.id = ve.target_id
       WHERE ve.target_type = 'post' AND ve.created_at >= ?
       GROUP BY ve.target_id
       HAVING events >= 8
       ORDER BY events DESC
       LIMIT ?`
    )
    .bind(LOW_KARMA_THRESHOLD, windowStart, limit)
    .all<{
      post_id: string;
      title: string;
      events: number;
      low_karma_events: number;
      weak_source_events: number;
    }>();
  return results ?? [];
}
