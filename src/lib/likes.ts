import { getDb } from "@/lib/db";
import { enforceCreateRateLimit } from "@/lib/rate-limit";
import { AuthError } from "@/lib/session";
import type { CommentLikeResult, LikeResult } from "@/lib/types";

async function mutatePostLike(input: {
  postId: string;
  userId: string;
  liked: boolean;
}): Promise<LikeResult> {
  const db = await getDb();
  const post = await db
    .prepare(
      `SELECT id, like_count FROM posts
       WHERE id = ? AND is_removed = 0 AND is_shadow_hidden = 0`
    )
    .bind(input.postId)
    .first<{ id: string; like_count: number }>();
  if (!post) throw new AuthError("Post not found", 404);

  const existing = await db
    .prepare(
      `SELECT 1 AS liked FROM post_likes
       WHERE post_id = ? AND user_id = ?`
    )
    .bind(input.postId, input.userId)
    .first();
  if (Boolean(existing) === input.liked) {
    return {
      postId: input.postId,
      likeCount: Number(post.like_count ?? 0),
      liked: input.liked,
    };
  }

  await enforceCreateRateLimit(input.userId, "like");
  const statements = input.liked
    ? [
        db
          .prepare(
            `INSERT OR IGNORE INTO post_likes (post_id, user_id, created_at)
             VALUES (?, ?, datetime('now'))`
          )
          .bind(input.postId, input.userId),
      ]
    : [
        db
          .prepare(
            `DELETE FROM post_likes WHERE post_id = ? AND user_id = ?`
          )
          .bind(input.postId, input.userId),
      ];

  statements.push(
    db
      .prepare(
        `UPDATE posts
         SET like_count = (
           SELECT COUNT(*) FROM post_likes WHERE post_id = posts.id
         ), updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(input.postId)
  );
  await db.batch(statements);

  const updated = await db
    .prepare(`SELECT like_count FROM posts WHERE id = ?`)
    .bind(input.postId)
    .first<{ like_count: number }>();
  return {
    postId: input.postId,
    likeCount: Number(updated?.like_count ?? 0),
    liked: input.liked,
  };
}

async function mutateCommentLike(input: {
  commentId: string;
  userId: string;
  liked: boolean;
}): Promise<CommentLikeResult> {
  const db = await getDb();
  const comment = await db
    .prepare(
      `SELECT c.id, c.like_count
       FROM comments c
       INNER JOIN posts p ON p.id = c.post_id
       WHERE c.id = ?
         AND c.is_removed = 0
         AND c.is_deleted = 0
         AND c.is_shadow_hidden = 0
         AND p.is_removed = 0
         AND p.is_shadow_hidden = 0`
    )
    .bind(input.commentId)
    .first<{ id: string; like_count: number }>();
  if (!comment) throw new AuthError("Comment not found", 404);

  const existing = await db
    .prepare(
      `SELECT 1 AS liked FROM comment_likes
       WHERE comment_id = ? AND user_id = ?`
    )
    .bind(input.commentId, input.userId)
    .first();
  if (Boolean(existing) === input.liked) {
    return {
      commentId: input.commentId,
      likeCount: Number(comment.like_count ?? 0),
      liked: input.liked,
    };
  }

  await enforceCreateRateLimit(input.userId, "like");
  const statements = input.liked
    ? [
        db
          .prepare(
            `INSERT OR IGNORE INTO comment_likes (comment_id, user_id, created_at)
             VALUES (?, ?, datetime('now'))`
          )
          .bind(input.commentId, input.userId),
      ]
    : [
        db
          .prepare(
            `DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?`
          )
          .bind(input.commentId, input.userId),
      ];

  statements.push(
    db
      .prepare(
        `UPDATE comments
         SET like_count = (
           SELECT COUNT(*) FROM comment_likes WHERE comment_id = comments.id
         ), updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(input.commentId)
  );
  await db.batch(statements);

  const updated = await db
    .prepare(`SELECT like_count FROM comments WHERE id = ?`)
    .bind(input.commentId)
    .first<{ like_count: number }>();
  return {
    commentId: input.commentId,
    likeCount: Number(updated?.like_count ?? 0),
    liked: input.liked,
  };
}

export function likePost(postId: string, userId: string) {
  return mutatePostLike({ postId, userId, liked: true });
}

export function unlikePost(postId: string, userId: string) {
  return mutatePostLike({ postId, userId, liked: false });
}

export function likeComment(commentId: string, userId: string) {
  return mutateCommentLike({ commentId, userId, liked: true });
}

export function unlikeComment(commentId: string, userId: string) {
  return mutateCommentLike({ commentId, userId, liked: false });
}
