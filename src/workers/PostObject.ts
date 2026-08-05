import { DurableObject } from "cloudflare:workers";

import type { InternalVoteResult, VoteAction } from "../lib/types";

const FLUSH_DELAY_MS = 5_000;

export interface PostObjectEnv {
  DB: D1Database;
}

interface VoteSnapshot {
  postId: string;
  upvotes: number;
  downvotes: number;
  pendingUp: number;
  pendingDown: number;
}

/**
 * One Durable Object instance per post.
 * Keeps live vote counts in memory (and DO storage), batches deltas,
 * and flushes to D1 on an alarm to avoid write races under load.
 */
export class PostObject extends DurableObject<PostObjectEnv> {
  #postId: string | null = null;
  #upvotes = 0;
  #downvotes = 0;
  #pendingUp = 0;
  #pendingDown = 0;
  #initialized = false;

  constructor(ctx: DurableObjectState, env: PostObjectEnv) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      await this.#hydrate();
    });
  }

  async vote(action: VoteAction, postId: string): Promise<InternalVoteResult> {
    await this.#ensureInitialized(postId);

    if (action === "upvote") {
      this.#upvotes += 1;
      this.#pendingUp += 1;
    } else {
      this.#downvotes += 1;
      this.#pendingDown += 1;
    }

    await this.#persist();
    await this.#scheduleFlush();

    return this.#toResult();
  }

  async getVotes(postId: string): Promise<InternalVoteResult> {
    await this.#ensureInitialized(postId);
    return this.#toResult();
  }

  async alarm(): Promise<void> {
    await this.#flushToD1();

    if (this.#pendingUp !== 0 || this.#pendingDown !== 0) {
      await this.#scheduleFlush(true);
    }
  }

  async #hydrate(): Promise<void> {
    const stored = await this.ctx.storage.get<VoteSnapshot>("votes");
    if (!stored) {
      return;
    }

    this.#postId = stored.postId;
    this.#upvotes = stored.upvotes;
    this.#downvotes = stored.downvotes;
    this.#pendingUp = stored.pendingUp;
    this.#pendingDown = stored.pendingDown;
    this.#initialized = true;
  }

  async #ensureInitialized(postIdHint?: string): Promise<void> {
    if (this.#initialized && this.#postId) {
      return;
    }

    const postId =
      postIdHint ?? this.ctx.id.name ?? (this.#postId || undefined);

    if (!postId) {
      throw new Error("PostObject requires a post id");
    }

    this.#postId = postId;

    const row = await this.env.DB.prepare(
      `SELECT upvotes, downvotes FROM posts WHERE id = ?`
    )
      .bind(postId)
      .first<{ upvotes: number; downvotes: number }>();

    if (row) {
      // Re-apply any unflushed deltas that survived eviction.
      this.#upvotes = row.upvotes + this.#pendingUp;
      this.#downvotes = row.downvotes + this.#pendingDown;
    }

    this.#initialized = true;
    await this.#persist();
  }

  async #persist(): Promise<void> {
    if (!this.#postId) {
      return;
    }

    const snapshot: VoteSnapshot = {
      postId: this.#postId,
      upvotes: this.#upvotes,
      downvotes: this.#downvotes,
      pendingUp: this.#pendingUp,
      pendingDown: this.#pendingDown,
    };

    await this.ctx.storage.put("votes", snapshot);
  }

  async #scheduleFlush(force = false): Promise<void> {
    if (!force) {
      const existing = await this.ctx.storage.getAlarm();
      if (existing !== null) {
        return;
      }
    }

    await this.ctx.storage.setAlarm(Date.now() + FLUSH_DELAY_MS);
  }

  async #flushToD1(): Promise<void> {
    await this.#ensureInitialized();

    const deltaUp = this.#pendingUp;
    const deltaDown = this.#pendingDown;

    if (!this.#postId || (deltaUp === 0 && deltaDown === 0)) {
      return;
    }

    // Clear pending before the write so a concurrent vote can accumulate a new batch.
    this.#pendingUp = 0;
    this.#pendingDown = 0;
    await this.#persist();

    try {
      const scoreDelta = deltaUp - deltaDown;
      const result = await this.env.DB.prepare(
        `UPDATE posts
         SET upvotes = upvotes + ?,
             downvotes = downvotes + ?,
             score = score + ?,
             updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(deltaUp, deltaDown, scoreDelta, this.#postId)
        .run();

      if (!result.success) {
        throw new Error("D1 vote flush failed");
      }
    } catch (error) {
      // Restore pending deltas so the next alarm retries.
      this.#pendingUp += deltaUp;
      this.#pendingDown += deltaDown;
      await this.#persist();
      throw error;
    }
  }

  #toResult(): InternalVoteResult {
    return {
      postId: this.#postId ?? "",
      upvotes: this.#upvotes,
      downvotes: this.#downvotes,
      score: this.#upvotes - this.#downvotes,
      pendingFlush: this.#pendingUp !== 0 || this.#pendingDown !== 0,
      viewerVote: null,
      alreadyVoted: false,
    };
  }
}
