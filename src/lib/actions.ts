import { getDb } from "@/lib/db";
import { createPublicId } from "@/lib/id";
import { moderateText } from "@/lib/moderation";
import {
  adjustAuthorKarma,
  bumpUserActivity,
  enforceCreateRateLimit,
} from "@/lib/rate-limit";
import { AuthError } from "@/lib/session";

export async function createPost(input: {
  userId: string;
  userStatus?: string | null;
  subredditId: string;
  title: string;
  body?: string | null;
  url?: string | null;
  mediaKey?: string | null;
}) {
  const title = input.title.trim();
  if (title.length < 3 || title.length > 300) {
    throw new AuthError("Title must be 3–300 characters", 400);
  }

  const body = input.body?.trim() || null;
  const url = input.url?.trim() || null;
  const mediaKey = input.mediaKey?.trim() || null;

  if (url && mediaKey) {
    throw new AuthError("Choose either a link or an image, not both", 400);
  }

  if (url) {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new AuthError("Invalid URL", 400);
      }
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError("Invalid URL", 400);
    }
  }

  if (mediaKey) {
    const { isAllowedMediaKey } = await import("@/lib/media");
    if (!isAllowedMediaKey(mediaKey)) {
      throw new AuthError("Invalid media", 400);
    }
  }

  await enforceCreateRateLimit(input.userId, "post");

  const moderation = await moderateText(`${title}\n${body ?? ""}`);
  if (moderation.blocked) {
    throw new AuthError("This content isn't allowed", 400);
  }

  const shadow =
    moderation.shadow || input.userStatus === "shadowbanned" ? 1 : 0;
  const id = createPublicId();
  const db = await getDb();

  const subreddit = await db
    .prepare(`SELECT name FROM subreddits WHERE id = ?`)
    .bind(input.subredditId)
    .first<{ name: string }>();

  await db
    .prepare(
      `INSERT INTO posts (
         id, subreddit_id, author_id, title, body, url, media_key, is_shadow_hidden
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.subredditId,
      input.userId,
      title,
      body,
      url,
      mediaKey,
      shadow
    )
    .run();

  try {
    const { refreshPostHotScore } = await import("@/lib/score-integrity");
    await refreshPostHotScore(id);
  } catch {
    // ignore if hot_score unavailable
  }

  await bumpUserActivity(input.userId, input.subredditId, 3);
  void import("@/lib/achievements").then(({ syncUserAchievements }) =>
    syncUserAchievements(input.userId)
  );

  if (!shadow && subreddit?.name) {
    void import("@/lib/embeddings").then(({ indexPostEmbedding }) =>
      indexPostEmbedding({
        postId: id,
        authorId: input.userId,
        subredditId: input.subredditId,
        subredditName: subreddit.name,
        title,
        body,
      })
    );
  }

  if (!shadow) {
    void import("@/lib/translation").then(({ schedulePostTranslation }) =>
      schedulePostTranslation(id)
    );
  }

  return { id };
}

export async function createComment(input: {
  userId: string;
  userStatus?: string | null;
  postId: string;
  parentId?: string | null;
  body: string;
}) {
  const body = input.body.trim();
  if (body.length < 1 || body.length > 10_000) {
    throw new AuthError("Comment must be 1–10000 characters", 400);
  }

  await enforceCreateRateLimit(input.userId, "comment");

  const db = await getDb();
  const post = await db
    .prepare(
      `SELECT id, subreddit_id, is_locked, is_removed FROM posts WHERE id = ?`
    )
    .bind(input.postId)
    .first<{
      id: string;
      subreddit_id: string;
      is_locked: number;
      is_removed: number;
    }>();

  if (!post || post.is_removed) {
    throw new AuthError("Post not found", 404);
  }
  if (post.is_locked) {
    throw new AuthError("Post is locked", 403);
  }

  let depth = 0;
  if (input.parentId) {
    const parent = await db
      .prepare(
        `SELECT id, depth, is_removed, is_deleted FROM comments WHERE id = ? AND post_id = ?`
      )
      .bind(input.parentId, input.postId)
      .first<{
        id: string;
        depth: number;
        is_removed: number;
        is_deleted: number;
      }>();
    if (!parent || parent.is_removed) {
      throw new AuthError("Parent comment not found", 404);
    }
    depth = parent.depth + 1;
    if (depth > 12) {
      throw new AuthError("Comment nesting too deep", 400);
    }
  }

  const moderation = await moderateText(body);
  if (moderation.blocked) {
    throw new AuthError("This content isn't allowed", 400);
  }

  const shadow =
    moderation.shadow || input.userStatus === "shadowbanned" ? 1 : 0;
  const id = createPublicId();

  await db
    .prepare(
      `INSERT INTO comments (
         id, post_id, author_id, parent_id, body, depth, is_shadow_hidden
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.postId,
      input.userId,
      input.parentId ?? null,
      body,
      depth,
      shadow
    )
    .run();

  if (!shadow) {
    await db
      .prepare(
        `UPDATE posts SET comment_count = comment_count + 1, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(input.postId)
      .run();
  }

  await bumpUserActivity(input.userId, post.subreddit_id, 1);
  void import("@/lib/achievements").then(({ syncUserAchievements }) =>
    syncUserAchievements(input.userId)
  );

  if (!shadow) {
    void import("@/lib/translation").then(({ scheduleCommentTranslation }) =>
      scheduleCommentTranslation(id)
    );

    void (async () => {
      const { notifyQuietly } = await import("@/lib/notifications");
      const meta = await db
        .prepare(
          `SELECT p.author_id AS post_author_id, p.title,
                  c.author_id AS parent_author_id,
                  u.username AS actor_username
           FROM posts p
           LEFT JOIN comments c ON c.id = ?
           LEFT JOIN "user" u ON u.id = ?
           WHERE p.id = ?`
        )
        .bind(input.parentId ?? null, input.userId, input.postId)
        .first<{
          post_author_id: string;
          title: string;
          parent_author_id: string | null;
          actor_username: string | null;
        }>();
      if (!meta) return;
      const actorLabel = meta.actor_username
        ? `@${meta.actor_username}`
        : "một người nào đó";
      const snippet = body.slice(0, 140);
      const href = `/post/${input.postId}`;

      if (input.parentId && meta.parent_author_id) {
        notifyQuietly({
          userId: meta.parent_author_id,
          actorId: input.userId,
          kind: "reply_to_comment",
          title: `${actorLabel} replied to your comment`,
          body: snippet,
          href,
          postId: input.postId,
          commentId: id,
        });
      } else {
        notifyQuietly({
          userId: meta.post_author_id,
          actorId: input.userId,
          kind: "comment_on_post",
          title: `${actorLabel} commented on your post`,
          body: snippet,
          href,
          postId: input.postId,
          commentId: id,
        });
      }
    })();
  }

  return { id, depth };
}

export async function softDeletePost(postId: string, actorId: string) {
  const db = await getDb();
  const post = await db
    .prepare(`SELECT id, author_id FROM posts WHERE id = ? AND is_removed = 0`)
    .bind(postId)
    .first<{ id: string; author_id: string }>();
  if (!post) throw new AuthError("Post not found", 404);

  await db
    .prepare(
      `UPDATE posts SET is_removed = 1, updated_at = datetime('now') WHERE id = ?`
    )
    .bind(postId)
    .run();

  await db
    .prepare(
      `INSERT INTO moderation_actions (
         id, actor_id, target_user_id, target_type, target_id, action, reason
       ) VALUES (?, ?, ?, 'post', ?, 'remove', 'soft delete')`
    )
    .bind(crypto.randomUUID(), actorId, post.author_id, postId)
    .run();

  void import("@/lib/embeddings").then(({ removePostEmbedding }) =>
    removePostEmbedding(postId)
  );
}

export async function softDeleteComment(commentId: string, actorId: string) {
  const db = await getDb();
  const comment = await db
    .prepare(
      `SELECT id, author_id, post_id FROM comments WHERE id = ? AND is_removed = 0`
    )
    .bind(commentId)
    .first<{ id: string; author_id: string; post_id: string }>();
  if (!comment) throw new AuthError("Comment not found", 404);

  await db
    .prepare(
      `UPDATE comments
       SET is_deleted = 1, is_removed = 1, body = '[deleted]', updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(commentId)
    .run();

  await db
    .prepare(
      `UPDATE posts SET comment_count = MAX(0, comment_count - 1), updated_at = datetime('now') WHERE id = ?`
    )
    .bind(comment.post_id)
    .run();

  await db
    .prepare(
      `INSERT INTO moderation_actions (
         id, actor_id, target_user_id, target_type, target_id, action, reason
       ) VALUES (?, ?, ?, 'comment', ?, 'remove', 'soft delete')`
    )
    .bind(crypto.randomUUID(), actorId, comment.author_id, commentId)
    .run();
}

export async function voteOnComment(input: {
  commentId: string;
  userId: string;
  voterKarma: number;
  userStatus?: string | null;
  action: "upvote" | "downvote";
}) {
  const {
    personalizedDisplayScore,
    signedVoteContribution,
  } = await import("@/lib/vote-weight");
  const {
    getVoterIntegrityContext,
    recordVoteEvent,
  } = await import("@/lib/score-integrity");
  const db = await getDb();
  const comment = await db
    .prepare(
      `SELECT id, author_id, post_id, score, is_removed
       FROM comments WHERE id = ?`
    )
    .bind(input.commentId)
    .first<{
      id: string;
      author_id: string;
      post_id: string;
      score: number;
      is_removed: number;
    }>();

  if (!comment || comment.is_removed) {
    throw new AuthError("Comment not found", 404);
  }

  const shadowVoter = input.userStatus === "shadowbanned";
  const value = input.action === "upvote" ? 1 : -1;

  const integrity = shadowVoter
    ? { weight: 0, discoverySource: null as null, hasPriorView: false }
    : await getVoterIntegrityContext({
        userId: input.userId,
        targetType: "comment",
        targetId: input.commentId,
        action: input.action,
        voterKarma: input.voterKarma,
        postIdForDiscovery: comment.post_id,
      });

  const weight = integrity.weight;
  const existing = await db
    .prepare(
      `SELECT value, weight FROM votes
       WHERE user_id = ? AND target_type = 'comment' AND target_id = ?`
    )
    .bind(input.userId, input.commentId)
    .first<{ value: number; weight: number }>();

  const scoreForVoter = (millipoints: number, appliedWeight: number) =>
    personalizedDisplayScore(millipoints, {
      value,
      weight: appliedWeight,
      voterKarma: input.voterKarma,
    });

  if (existing?.value === value) {
    return {
      commentId: comment.id,
      score: scoreForVoter(comment.score, Number(existing.weight ?? 0)),
      viewerVote: input.action,
    };
  }

  await enforceCreateRateLimit(input.userId, "vote");

  const previous = existing?.value ?? null;
  const previousWeight = Number(existing?.weight ?? 0);
  const previousSigned =
    previous === null
      ? 0
      : previous === 1
        ? previousWeight
        : -previousWeight;
  const nextSigned = signedVoteContribution(input.action, weight);
  const scoreDelta = shadowVoter ? 0 : nextSigned - previousSigned;

  let deltaUp = 0;
  let deltaDown = 0;

  if (!existing) {
    if (!shadowVoter) {
      if (value === 1) deltaUp = 1;
      else deltaDown = 1;
    }
    await db
      .prepare(
        `INSERT INTO votes (id, user_id, target_type, target_id, value, voter_karma_at_vote, weight)
         VALUES (?, ?, 'comment', ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        input.userId,
        input.commentId,
        value,
        input.voterKarma,
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
         WHERE user_id = ? AND target_type = 'comment' AND target_id = ?`
      )
      .bind(
        value,
        input.voterKarma,
        weight,
        input.userId,
        input.commentId
      )
      .run();
  }

  await recordVoteEvent({
    targetType: "comment",
    targetId: input.commentId,
    userId: input.userId,
    value,
    weight,
    voterKarma: input.voterKarma,
    discoverySource: integrity.discoverySource,
  });

  if (!shadowVoter) {
    await db
      .prepare(
        `UPDATE comments
         SET upvotes = MAX(0, upvotes + ?),
             downvotes = MAX(0, downvotes + ?),
             score = score + ?,
             updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(deltaUp, deltaDown, scoreDelta, input.commentId)
      .run();

    const authorKarmaDelta = Math.trunc(scoreDelta / 100);
    if (authorKarmaDelta !== 0 && comment.author_id !== input.userId) {
      await adjustAuthorKarma(comment.author_id, "comment", authorKarmaDelta);
    }
  }

  void import("@/lib/achievements").then(({ syncAchievementsQuietly }) => {
    syncAchievementsQuietly(input.userId);
  });

  const updated = await db
    .prepare(`SELECT score FROM comments WHERE id = ?`)
    .bind(input.commentId)
    .first<{ score: number }>();

  return {
    commentId: input.commentId,
    score: scoreForVoter(updated?.score ?? comment.score, weight),
    viewerVote: input.action,
  };
}

export async function editPost(input: {
  postId: string;
  userId: string;
  title?: string;
  body?: string | null;
  url?: string | null;
}) {
  const db = await getDb();
  const post = await db
    .prepare(
      `SELECT id, author_id, title, body, url FROM posts WHERE id = ? AND is_removed = 0`
    )
    .bind(input.postId)
    .first<{
      id: string;
      author_id: string;
      title: string;
      body: string | null;
      url: string | null;
    }>();

  if (!post) throw new AuthError("Post not found", 404);
  if (post.author_id !== input.userId) {
    throw new AuthError("Only the author can edit this post", 403);
  }

  const title = (input.title ?? post.title).trim();
  if (title.length < 3 || title.length > 300) {
    throw new AuthError("Title must be 3–300 characters", 400);
  }
  const body =
    input.body === undefined ? post.body : input.body?.trim() || null;
  const url = input.url === undefined ? post.url : input.url?.trim() || null;
  if (url) {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new AuthError("Invalid URL", 400);
      }
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError("Invalid URL", 400);
    }
  }

  const moderation = await moderateText(`${title}\n${body ?? ""}`);
  if (moderation.blocked) {
    throw new AuthError("This content isn't allowed", 400);
  }

  await db
    .prepare(
      `UPDATE posts
       SET title = ?, body = ?, url = ?,
           source_lang = NULL,
           title_translated = NULL,
           body_translated = NULL,
           translation_status = 'pending',
           is_shadow_hidden = CASE WHEN ? THEN 1 ELSE is_shadow_hidden END,
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(title, body, url, moderation.shadow ? 1 : 0, input.postId)
    .run();

  if (!moderation.shadow) {
    const meta = await db
      .prepare(
        `SELECT p.subreddit_id, p.author_id, s.name AS subreddit_name
         FROM posts p
         INNER JOIN subreddits s ON s.id = p.subreddit_id
         WHERE p.id = ?`
      )
      .bind(input.postId)
      .first<{
        subreddit_id: string;
        author_id: string;
        subreddit_name: string;
      }>();
    if (meta) {
      void import("@/lib/embeddings").then(({ indexPostEmbedding }) =>
        indexPostEmbedding({
          postId: input.postId,
          authorId: meta.author_id,
          subredditId: meta.subreddit_id,
          subredditName: meta.subreddit_name,
          title,
          body,
        })
      );
    }
    void import("@/lib/translation").then(({ schedulePostTranslation }) =>
      schedulePostTranslation(input.postId)
    );
  }

  return { id: input.postId, title, body, url };
}

export async function editComment(input: {
  commentId: string;
  userId: string;
  body: string;
}) {
  const body = input.body.trim();
  if (body.length < 1 || body.length > 10_000) {
    throw new AuthError("Comment must be 1–10000 characters", 400);
  }

  const db = await getDb();
  const comment = await db
    .prepare(
      `SELECT id, author_id, is_deleted FROM comments WHERE id = ? AND is_removed = 0`
    )
    .bind(input.commentId)
    .first<{ id: string; author_id: string; is_deleted: number }>();

  if (!comment || comment.is_deleted) {
    throw new AuthError("Comment not found", 404);
  }
  if (comment.author_id !== input.userId) {
    throw new AuthError("Only the author can edit this comment", 403);
  }

  const moderation = await moderateText(body);
  if (moderation.blocked) {
    throw new AuthError("This content isn't allowed", 400);
  }

  await db
    .prepare(
      `UPDATE comments
       SET body = ?,
           source_lang = NULL,
           body_translated = NULL,
           translation_status = 'pending',
           is_shadow_hidden = CASE WHEN ? THEN 1 ELSE is_shadow_hidden END,
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(body, moderation.shadow ? 1 : 0, input.commentId)
    .run();

  if (!moderation.shadow) {
    void import("@/lib/translation").then(({ scheduleCommentTranslation }) =>
      scheduleCommentTranslation(input.commentId)
    );
  }

  return { id: input.commentId, body };
}

export async function createSubreddit(input: {
  userId: string;
  name: string;
  title: string;
  description?: string | null;
}) {
  const { slugifySubreddit } = await import("@/lib/permissions");
  const name = slugifySubreddit(input.name);
  if (name.length < 3) {
    throw new AuthError("Community name must be at least 3 characters", 400);
  }
  const title = input.title.trim();
  if (title.length < 3 || title.length > 100) {
    throw new AuthError("Title must be 3–100 characters", 400);
  }

  const moderation = await moderateText(
    `${name}\n${title}\n${input.description ?? ""}`
  );
  if (moderation.blocked) {
    throw new AuthError("This content isn't allowed", 400);
  }

  const db = await getDb();
  const existing = await db
    .prepare(`SELECT id FROM subreddits WHERE name = ? COLLATE NOCASE`)
    .bind(name)
    .first();
  if (existing) {
    throw new AuthError("Community name already taken", 409);
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO subreddits (id, name, title, description, created_by, subscriber_count)
       VALUES (?, ?, ?, ?, ?, 0)`
    )
    .bind(id, name, title, input.description?.trim() || null, input.userId)
    .run();

  await db
    .prepare(
      `INSERT INTO subscriptions (user_id, subreddit_id) VALUES (?, ?)`
    )
    .bind(input.userId, id)
    .run();

  const { recountSubscribers } = await import("@/lib/communities");
  await recountSubscribers(id);

  await db
    .prepare(
      `INSERT INTO subreddit_moderators (subreddit_id, user_id) VALUES (?, ?)`
    )
    .bind(id, input.userId)
    .run();

  void import("@/lib/achievements").then(({ syncUserAchievements }) =>
    syncUserAchievements(input.userId)
  );

  return { id, name };
}
