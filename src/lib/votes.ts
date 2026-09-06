import { getDb, getEnv } from "@/lib/db";
import { syncAchievementsForEvent } from "@/lib/achievements";
import {
  getVoterIntegrityContext,
  recordVoteEvent,
  refreshPostHotScore,
} from "@/lib/score-integrity";
import {
  displayScore,
  personalizedDisplayScore,
  signedVoteContribution,
} from "@/lib/vote-weight";
import {
  adjustAuthorKarma,
  bumpUserActivity,
  enforceCreateRateLimit,
} from "@/lib/rate-limit";
import type { VoteAction, VoteResult, ViewerVote } from "@/lib/types";
import type { PostObject } from "@/workers/PostObject";

export {
  displayScore,
  personalizedDisplayScore,
  voteWeight,
} from "@/lib/vote-weight";

export interface VoteActor {
  userId: string;
  voterKarma: number;
  userStatus?: string | null;
}

function getPostStub(env: CloudflareEnv, postId: string) {
  return env.POST_OBJECT.getByName(postId) as DurableObjectStub<PostObject>;
}

export function voteValueToAction(value: number | null | undefined): ViewerVote {
  if (value === 1) return "upvote";
  if (value === -1) return "downvote";
  return null;
}

async function readPostScore(postId: string) {
  const db = await getDb();
  const row = await db
    .prepare(`SELECT score FROM posts WHERE id = ?`)
    .bind(postId)
    .first<{ score: number }>();
  if (!row) throw new Error("Post not found");
  return row.score;
}

function scoreForVoter(
  millipoints: number,
  action: VoteAction,
  appliedWeight: number
) {
  return personalizedDisplayScore(millipoints, {
    value: action === "upvote" ? 1 : -1,
    weight: appliedWeight,
  });
}

async function applyPostVoteDelta(
  postId: string,
  deltaUp: number,
  deltaDown: number,
  scoreDelta: number
) {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE posts
       SET upvotes = MAX(0, upvotes + ?),
           downvotes = MAX(0, downvotes + ?),
           score = score + ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(deltaUp, deltaDown, scoreDelta, postId)
    .run();
  await refreshPostHotScore(postId);
}

/**
 * Authenticated vote with integrity-weighted millipoints.
 * Shadowbanned voters get a convincing personal score but do not move the real tally.
 */
export async function voteOnPost(
  postId: string,
  action: VoteAction,
  actor: VoteActor
): Promise<VoteResult> {
  const db = await getDb();
  const postMeta = await db
    .prepare(
      `SELECT author_id, subreddit_id FROM posts WHERE id = ? AND is_removed = 0`
    )
    .bind(postId)
    .first<{ author_id: string; subreddit_id: string }>();

  if (!postMeta) {
    throw new Error("Post not found");
  }

  const shadowVoter = actor.userStatus === "shadowbanned";
  const value = action === "upvote" ? 1 : -1;

  const integrity = shadowVoter
    ? { weight: 0, discoverySource: null as null, hasPriorView: false }
    : await getVoterIntegrityContext({
        userId: actor.userId,
        targetType: "post",
        targetId: postId,
        action,
      });

  const weight = integrity.weight;
  const existing = await db
    .prepare(
      `SELECT value, weight FROM votes
       WHERE user_id = ? AND target_type = 'post' AND target_id = ?`
    )
    .bind(actor.userId, postId)
    .first<{ value: number; weight: number }>();

  if (existing?.value === value) {
    return {
      postId,
      score: scoreForVoter(
        await readPostScore(postId),
        action,
        Number(existing.weight ?? 0)
      ),
      viewerVote: action,
    };
  }

  await enforceCreateRateLimit(actor.userId, "vote");

  const previous = existing?.value ?? null;
  const previousWeight = Number(existing?.weight ?? 0);
  const previousSigned =
    previous === null
      ? 0
      : previous === 1
        ? previousWeight
        : -previousWeight;
  const nextSigned = signedVoteContribution(action, weight);
  const scoreDelta = shadowVoter ? 0 : nextSigned - previousSigned;

  let deltaUp = 0;
  let deltaDown = 0;

  if (previous === null) {
    if (!shadowVoter) {
      if (value === 1) deltaUp = 1;
      else deltaDown = 1;
    }
    await db
      .prepare(
        `INSERT INTO votes (id, user_id, target_type, target_id, value, voter_karma_at_vote, weight)
         VALUES (?, ?, 'post', ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        actor.userId,
        postId,
        value,
        actor.voterKarma,
        weight
      )
      .run();
  } else {
    if (!shadowVoter) {
      if (value === 1) {
        deltaUp = 1;
        deltaDown = -1;
      } else {
        deltaUp = -1;
        deltaDown = 1;
      }
    }
    await db
      .prepare(
        `UPDATE votes
         SET value = ?, voter_karma_at_vote = ?, weight = ?, updated_at = datetime('now')
         WHERE user_id = ? AND target_type = 'post' AND target_id = ?`
      )
      .bind(value, actor.voterKarma, weight, actor.userId, postId)
      .run();
  }

  await recordVoteEvent({
    targetType: "post",
    targetId: postId,
    userId: actor.userId,
    value,
    weight,
    voterKarma: actor.voterKarma,
    discoverySource: integrity.discoverySource,
  });

  if (!shadowVoter) {
    await applyPostVoteDelta(postId, deltaUp, deltaDown, scoreDelta);
    const authorKarmaDelta = Math.trunc(scoreDelta / 100);
    if (authorKarmaDelta !== 0 && postMeta.author_id !== actor.userId) {
      await adjustAuthorKarma(postMeta.author_id, "post", authorKarmaDelta);
    }
  }

  await bumpUserActivity(actor.userId, postMeta.subreddit_id, 1);

  syncAchievementsForEvent(actor.userId, "vote_cast");
  if (postMeta.author_id !== actor.userId) {
    syncAchievementsForEvent(postMeta.author_id, "karma_changed");
  }

  try {
    const env = await getEnv();
    const stub = getPostStub(env, postId);
    await stub.getVotes(postId);
  } catch {
    // Local next-dev without DO binding is fine.
  }

  return {
    postId,
    score: scoreForVoter(await readPostScore(postId), action, weight),
    viewerVote: action,
  };
}

export async function removeVoteOnPost(
  postId: string,
  actor: VoteActor
): Promise<VoteResult> {
  const db = await getDb();
  const post = await db
    .prepare(`SELECT author_id FROM posts WHERE id = ? AND is_removed = 0`)
    .bind(postId)
    .first<{ author_id: string }>();
  if (!post) throw new Error("Post not found");

  const existing = await db
    .prepare(
      `SELECT value, weight FROM votes
       WHERE user_id = ? AND target_type = 'post' AND target_id = ?`
    )
    .bind(actor.userId, postId)
    .first<{ value: number; weight: number }>();
  if (!existing) {
    return {
      postId,
      score: displayScore(await readPostScore(postId)),
      viewerVote: null,
    };
  }

  const shadowVoter = actor.userStatus === "shadowbanned";
  const weight = Number(existing.weight ?? 0);
  const signedContribution = existing.value === 1 ? weight : -weight;
  const scoreDelta = shadowVoter ? 0 : -signedContribution;

  await db
    .prepare(
      `DELETE FROM votes
       WHERE user_id = ? AND target_type = 'post' AND target_id = ?`
    )
    .bind(actor.userId, postId)
    .run();

  if (!shadowVoter) {
    await applyPostVoteDelta(
      postId,
      existing.value === 1 ? -1 : 0,
      existing.value === -1 ? -1 : 0,
      scoreDelta
    );
    const authorKarmaDelta = Math.trunc(scoreDelta / 100);
    if (authorKarmaDelta !== 0 && post.author_id !== actor.userId) {
      await adjustAuthorKarma(post.author_id, "post", authorKarmaDelta);
    }
  }

  try {
    const env = await getEnv();
    const stub = getPostStub(env, postId);
    await stub.getVotes(postId);
  } catch {
    // Local next-dev without DO binding is fine.
  }

  return {
    postId,
    score: displayScore(await readPostScore(postId)),
    viewerVote: null,
  };
}

export async function getLiveVotes(postId: string): Promise<VoteResult> {
  return {
    postId,
    score: displayScore(await readPostScore(postId)),
    viewerVote: null,
  };
}
