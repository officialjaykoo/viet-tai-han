import { getDb } from "@/lib/db";
import { syncAchievementsForEvent } from "@/lib/achievements";
import { createPublicId } from "@/lib/id";
import { moderateText } from "@/lib/moderation";
import {
  bumpUserActivity,
  enforceCreateRateLimit,
} from "@/lib/rate-limit";
import { requireAdmin, type SessionUser } from "@/lib/permissions";
import { AuthError } from "@/lib/session";
import { normalizeRequestId } from "@/lib/idempotency";
import {
  MAX_POST_BODY_LENGTH,
  MAX_POST_TITLE_LENGTH,
  MAX_POST_URL_LENGTH,
  MIN_POST_TITLE_LENGTH,
} from "@/lib/post-limits";

import { MAX_COMMENT_DEPTH } from "@/lib/comment-constants";
import { isProfileCommunityName } from "@/lib/profile-community";

export async function createPost(input: {
  userId: string;
  userStatus?: string | null;
  subredditId: string;
  title: string;
  body?: string | null;
  url?: string | null;
  mediaKey?: string | null;
  requestId?: string | null;
}) {
  if (typeof input.title !== "string") {
    throw new AuthError("Invalid post payload", 400);
  }
  if (
    input.body !== undefined &&
    input.body !== null &&
    typeof input.body !== "string"
  ) {
    throw new AuthError("Invalid post payload", 400);
  }
  if (
    input.url !== undefined &&
    input.url !== null &&
    typeof input.url !== "string"
  ) {
    throw new AuthError("Invalid post payload", 400);
  }
  if (
    input.mediaKey !== undefined &&
    input.mediaKey !== null &&
    typeof input.mediaKey !== "string"
  ) {
    throw new AuthError("Invalid post payload", 400);
  }
  if (
    input.requestId !== undefined &&
    input.requestId !== null &&
    typeof input.requestId !== "string"
  ) {
    throw new AuthError("Invalid post payload", 400);
  }

  const title = input.title.trim();
  if (
    title.length < MIN_POST_TITLE_LENGTH ||
    title.length > MAX_POST_TITLE_LENGTH
  ) {
    throw new AuthError("Title must be 3–300 characters", 400);
  }

  const body = input.body?.trim() || null;
  if (body && body.length > MAX_POST_BODY_LENGTH) {
    throw new AuthError(
      "Post body must be 20,000 characters or fewer",
      400
    );
  }
  const url = input.url?.trim() || null;
  if (url && url.length > MAX_POST_URL_LENGTH) {
    throw new AuthError("Post URL must be 2,048 characters or fewer", 400);
  }
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

  const requestId = normalizeRequestId(input.requestId);
  const db = await getDb();
  if (requestId) {
    const existing = await db
      .prepare(
        `SELECT id FROM posts WHERE author_id = ? AND request_id = ?`
      )
      .bind(input.userId, requestId)
      .first<{ id: string }>();
    if (existing) return { id: existing.id };
  }

  const subreddit = await db
    .prepare(
      `SELECT id, name, created_by, is_removed
       FROM subreddits WHERE id = ?`
    )
    .bind(input.subredditId)
    .first<{
      id: string;
      name: string;
      created_by: string | null;
      is_removed: number;
    }>();
  if (!subreddit || subreddit.is_removed) {
    throw new AuthError("Community not found", 404);
  }
  if (
    isProfileCommunityName(subreddit.name) &&
    subreddit.created_by !== input.userId
  ) {
    throw new AuthError("Profile community belongs to another user", 403);
  }
  if (mediaKey) {
    const { assertOwnedMediaKey } = await import("@/lib/media");
    await assertOwnedMediaKey(mediaKey, input.userId);
  }

  await enforceCreateRateLimit(input.userId, "post");

  const moderation = await moderateText(`${title}\n${body ?? ""}`);
  if (moderation.blocked) {
    throw new AuthError("This content isn't allowed", 400);
  }

  const shadow =
    moderation.shadow || input.userStatus === "shadowbanned" ? 1 : 0;
  const id = createPublicId();

  try {
    await db
      .prepare(
        `INSERT INTO posts (
           id, subreddit_id, author_id, title, body, url, media_key,
           is_shadow_hidden, request_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.subredditId,
        input.userId,
        title,
        body,
        url,
        mediaKey,
        shadow,
        requestId
      )
      .run();
  } catch (error) {
    if (!requestId) throw error;
    const existing = await db
      .prepare(
        `SELECT id FROM posts WHERE author_id = ? AND request_id = ?`
      )
      .bind(input.userId, requestId)
      .first<{ id: string }>();
    if (existing) return { id: existing.id };
    throw error;
  }

  try {
    await bumpUserActivity(input.userId, input.subredditId, 3);
  } catch (error) {
    console.error("post_activity_update_failed", error);
  }
  syncAchievementsForEvent(input.userId, "post_created");

  if (!shadow) {
    void import("@/lib/translation")
      .then(({ schedulePostTranslation }) => schedulePostTranslation(id))
      .catch((error) => {
        console.error("post_translation_schedule_failed", error);
      });
  }

  return { id };
}

export async function createComment(input: {
  userId: string;
  userStatus?: string | null;
  postId: string;
  parentId?: string | null;
  body: string;
  requestId?: string | null;
}) {
  const body = input.body.trim();

  const requestId = normalizeRequestId(input.requestId);
  const db = await getDb();
  if (requestId) {
    const existing = await db
      .prepare(
        `SELECT id, depth FROM comments WHERE author_id = ? AND request_id = ?`
      )
      .bind(input.userId, requestId)
      .first<{ id: string; depth: number }>();
    if (existing) return { id: existing.id, depth: existing.depth };
  }

  await enforceCreateRateLimit(input.userId, "comment");
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
    if (!parent || parent.is_removed || parent.is_deleted) {
      throw new AuthError("Parent comment not found", 404);
    }
    depth = parent.depth + 1;
    if (depth > MAX_COMMENT_DEPTH) {
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

  const insert = input.parentId
    ? db
        .prepare(
          `INSERT INTO comments (
             id, post_id, author_id, parent_id, body, depth, is_shadow_hidden,
             request_id
           )
           SELECT ?, p.id, ?, parent.id, ?, parent.depth + 1, ?, ?
           FROM posts p
           INNER JOIN comments parent ON parent.post_id = p.id
           WHERE p.id = ?
             AND p.is_removed = 0
             AND p.is_locked = 0
             AND parent.id = ?
             AND parent.is_removed = 0
             AND parent.is_deleted = 0
             AND parent.depth < ?`
        )
        .bind(
          id,
          input.userId,
          body,
          shadow,
          requestId,
          input.postId,
          input.parentId,
          MAX_COMMENT_DEPTH
        )
    : db
        .prepare(
          `INSERT INTO comments (
             id, post_id, author_id, parent_id, body, depth, is_shadow_hidden,
             request_id
           )
           SELECT ?, p.id, ?, NULL, ?, 0, ?, ?
           FROM posts p
           WHERE p.id = ?
             AND p.is_removed = 0
             AND p.is_locked = 0`
        )
        .bind(
          id,
          input.userId,
          body,
          shadow,
          requestId,
          input.postId
        );

  let results: D1Result<unknown>[];
  try {
    const statements = [insert];
    if (!shadow) {
      statements.push(
        db
          .prepare(
            `UPDATE posts
             SET comment_count = comment_count + 1,
                 updated_at = datetime('now')
             WHERE id = ?
               AND EXISTS (SELECT 1 FROM comments WHERE id = ?)`
          )
          .bind(input.postId, id)
      );
    }
    results = await db.batch(statements);
  } catch (error) {
    if (!requestId) throw error;
    const existing = await db
      .prepare(
        `SELECT id, depth FROM comments WHERE author_id = ? AND request_id = ?`
      )
      .bind(input.userId, requestId)
      .first<{ id: string; depth: number }>();
    if (existing) return { id: existing.id, depth: existing.depth };
    throw error;
  }

  if (Number(results[0]?.meta.changes ?? 0) !== 1) {
    throw new AuthError(
      input.parentId ? "Parent comment not found" : "Post not found",
      404
    );
  }

  await bumpUserActivity(input.userId, post.subreddit_id, 1);
  syncAchievementsForEvent(input.userId, "comment_created");

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

export async function deleteOwnPost(postId: string, actorId: string) {
  const db = await getDb();
  const post = await db
    .prepare(`SELECT id, author_id, is_removed FROM posts WHERE id = ?`)
    .bind(postId)
    .first<{ id: string; author_id: string; is_removed: number }>();

  if (!post || post.is_removed) {
    throw new AuthError("Post not found", 404);
  }
  if (post.author_id !== actorId) {
    throw new AuthError("Only the author can delete this post", 403);
  }

  const result = await db
    .prepare(
      `UPDATE posts
       SET is_removed = 1, updated_at = datetime('now')
       WHERE id = ?
         AND author_id = ?
         AND is_removed = 0
         AND NOT EXISTS (
           SELECT 1 FROM comments WHERE post_id = posts.id
         )`
    )
    .bind(postId, actorId)
    .run();

  if (Number(result.meta.changes ?? 0) !== 1) {
    const hasComments = await db
      .prepare(`SELECT 1 AS present FROM comments WHERE post_id = ? LIMIT 1`)
      .bind(postId)
      .first();
    if (hasComments) {
      throw new AuthError("Post has comments and cannot be deleted", 409);
    }
    throw new AuthError("Post not found", 404);
  }

  await db
    .prepare(
      `INSERT INTO moderation_actions (
         id, actor_id, target_user_id, target_type, target_id, action, reason
       ) VALUES (?, ?, ?, 'post', ?, 'remove', 'author delete')`
    )
    .bind(crypto.randomUUID(), actorId, post.author_id, postId)
    .run();
}

export async function removePostForModeration(
  postId: string,
  actorId: string
) {
  const db = await getDb();
  const post = await db
    .prepare(`SELECT id, author_id FROM posts WHERE id = ? AND is_removed = 0`)
    .bind(postId)
    .first<{ id: string; author_id: string }>();
  if (!post) throw new AuthError("Post not found", 404);

  const result = await db
    .prepare(
      `UPDATE posts SET is_removed = 1, updated_at = datetime('now')
       WHERE id = ? AND is_removed = 0`
    )
    .bind(postId)
    .run();
  if (Number(result.meta.changes ?? 0) !== 1) {
    throw new AuthError("Post not found", 404);
  }

  await db
    .prepare(
      `INSERT INTO moderation_actions (
         id, actor_id, target_user_id, target_type, target_id, action, reason
       ) VALUES (?, ?, ?, 'post', ?, 'remove', 'moderator remove')`
    )
    .bind(crypto.randomUUID(), actorId, post.author_id, postId)
    .run();
}

export async function deleteOwnComment(commentId: string, actorId: string) {
  const db = await getDb();
  const comment = await db
    .prepare(
      `SELECT id, author_id, post_id, is_deleted, is_removed, is_shadow_hidden
       FROM comments WHERE id = ?`
    )
    .bind(commentId)
    .first<{
      id: string;
      author_id: string;
      post_id: string;
      is_deleted: number;
      is_removed: number;
      is_shadow_hidden: number;
    }>();

  if (!comment || comment.is_removed || comment.is_deleted) {
    throw new AuthError("Comment not found", 404);
  }
  if (comment.author_id !== actorId) {
    throw new AuthError("Only the author can delete this comment", 403);
  }

  const result = await db
    .prepare(
      `UPDATE comments
       SET is_deleted = 1,
           is_removed = 0,
           body = '[deleted]',
           source_lang = NULL,
           translation_target_lang = NULL,
           body_translated = NULL,
           translation_status = 'skipped',
           updated_at = datetime('now')
       WHERE id = ?
         AND author_id = ?
         AND is_deleted = 0
         AND is_removed = 0
         AND NOT EXISTS (
           SELECT 1 FROM comments child WHERE child.parent_id = comments.id
         )`
    )
    .bind(commentId, actorId)
    .run();

  if (Number(result.meta.changes ?? 0) !== 1) {
    const hasChildren = await db
      .prepare(`SELECT 1 AS present FROM comments WHERE parent_id = ? LIMIT 1`)
      .bind(commentId)
      .first();
    if (hasChildren) {
      throw new AuthError("Comment has replies and cannot be deleted", 409);
    }
    throw new AuthError("Comment not found", 404);
  }

  if (!comment.is_shadow_hidden) {
    await db
      .prepare(
        `UPDATE posts
         SET comment_count = MAX(0, comment_count - 1),
             updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(comment.post_id)
      .run();
  }

  await db
    .prepare(
      `INSERT INTO moderation_actions (
         id, actor_id, target_user_id, target_type, target_id, action, reason
       ) VALUES (?, ?, ?, 'comment', ?, 'remove', 'author delete')`
    )
    .bind(crypto.randomUUID(), actorId, comment.author_id, commentId)
    .run();
}

export async function removeCommentForModeration(
  commentId: string,
  actorId: string
) {
  const db = await getDb();
  const comment = await db
    .prepare(
      `SELECT id, author_id, post_id, is_deleted, is_removed, is_shadow_hidden
       FROM comments WHERE id = ?`
    )
    .bind(commentId)
    .first<{
      id: string;
      author_id: string;
      post_id: string;
      is_deleted: number;
      is_removed: number;
      is_shadow_hidden: number;
    }>();
  if (!comment || comment.is_removed) {
    throw new AuthError("Comment not found", 404);
  }

  const result = await db
    .prepare(
      `UPDATE comments
       SET is_removed = 1,
           body = CASE WHEN is_deleted = 1 THEN '[deleted]' ELSE '[removed]' END,
           source_lang = NULL,
           translation_target_lang = NULL,
           body_translated = NULL,
           translation_status = 'skipped',
           updated_at = datetime('now')
       WHERE id = ? AND is_removed = 0 AND is_deleted = 0`
    )
    .bind(commentId)
    .run();
  if (Number(result.meta.changes ?? 0) !== 1) {
    throw new AuthError("Comment not found", 404);
  }

  if (!comment.is_deleted && !comment.is_shadow_hidden) {
    await db
      .prepare(
        `UPDATE posts
         SET comment_count = MAX(0, comment_count - 1),
             updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(comment.post_id)
      .run();
  }

  await db
    .prepare(
      `INSERT INTO moderation_actions (
         id, actor_id, target_user_id, target_type, target_id, action, reason
       ) VALUES (?, ?, ?, 'comment', ?, 'remove', 'moderator remove')`
    )
    .bind(crypto.randomUUID(), actorId, comment.author_id, commentId)
    .run();
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
      `SELECT id, author_id, title, body, url, media_key
       FROM posts WHERE id = ? AND is_removed = 0`
    )
    .bind(input.postId)
    .first<{
      id: string;
      author_id: string;
      title: string;
      body: string | null;
      url: string | null;
      media_key: string | null;
    }>();

  if (!post) throw new AuthError("Post not found", 404);
  if (post.author_id !== input.userId) {
    throw new AuthError("Only the author can edit this post", 403);
  }

  if (
    input.title !== undefined &&
    typeof input.title !== "string"
  ) {
    throw new AuthError("Invalid post payload", 400);
  }
  if (
    input.body !== undefined &&
    input.body !== null &&
    typeof input.body !== "string"
  ) {
    throw new AuthError("Invalid post payload", 400);
  }
  if (
    input.url !== undefined &&
    input.url !== null &&
    typeof input.url !== "string"
  ) {
    throw new AuthError("Invalid post payload", 400);
  }

  const postType = post.media_key ? "image" : post.url ? "link" : "text";
  if (
    (postType === "text" && input.url !== undefined) ||
    (postType === "link" && input.body !== undefined) ||
    (postType === "image" &&
      (input.body !== undefined || input.url !== undefined))
  ) {
    throw new AuthError("Post type cannot be changed while editing", 400);
  }

  const title = (input.title ?? post.title).trim();
  if (
    title.length < MIN_POST_TITLE_LENGTH ||
    title.length > MAX_POST_TITLE_LENGTH
  ) {
    throw new AuthError("Title must be 3–300 characters", 400);
  }
  const body =
    postType === "text"
      ? input.body === undefined
        ? post.body
        : input.body?.trim() || null
      : null;
  if (body && body.length > MAX_POST_BODY_LENGTH) {
    throw new AuthError(
      "Post body must be 20,000 characters or fewer",
      400
    );
  }
  const url =
    postType === "link"
      ? input.url === undefined
        ? post.url
        : input.url?.trim() || null
      : null;
  if (postType === "link" && !url) {
    throw new AuthError("Link posts require a URL", 400);
  }
  if (url && url.length > MAX_POST_URL_LENGTH) {
    throw new AuthError("Post URL must be 2,048 characters or fewer", 400);
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

  const moderation = await moderateText(`${title}\n${body ?? ""}`);
  if (moderation.blocked) {
    throw new AuthError("This content isn't allowed", 400);
  }

  await db
    .prepare(
      `UPDATE posts
       SET title = ?, body = ?, url = ?,
           source_lang = NULL,
           translation_target_lang = NULL,
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
    void import("@/lib/translation")
      .then(({ schedulePostTranslation }) =>
        schedulePostTranslation(input.postId)
      )
      .catch((error) => {
        console.error("post_translation_schedule_failed", error);
      });
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
           translation_target_lang = NULL,
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
  actor: SessionUser;
  name: string;
  title: string;
  description?: string | null;
}) {
  await requireAdmin(input.actor);
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
    .bind(id, name, title, input.description?.trim() || null, input.actor.id)
    .run();

  await db
    .prepare(
      `INSERT INTO subscriptions (user_id, subreddit_id) VALUES (?, ?)`
    )
    .bind(input.actor.id, id)
    .run();

  const { recountSubscribers } = await import("@/lib/communities");
  await recountSubscribers(id);

  await db
    .prepare(
      `INSERT INTO subreddit_moderators (subreddit_id, user_id) VALUES (?, ?)`
    )
    .bind(id, input.actor.id)
    .run();

  syncAchievementsForEvent(input.actor.id, "community_created");

  return { id, name };
}
