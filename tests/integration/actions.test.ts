import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import {
  createComment,
  createPost,
  createSubreddit,
  editComment,
  editPost,
  softDeleteComment,
  softDeletePost,
} from "@/lib/actions";
import { getFeedPosts } from "@/lib/db";
import { AuthError } from "@/lib/session";
import {
  blockUser,
  followUser,
  hidePost,
  reportTarget,
  unblockUser,
  unfollowUser,
  unhidePost,
} from "@/lib/user-actions";
import {
  likeComment,
  likePost,
  unlikeComment,
  unlikePost,
} from "@/lib/likes";

import {
  getCommentRow,
  getPostRow,
  seedUsersAndSubreddit,
} from "./helpers";

describe("content lifecycle (D1)", () => {
  it("creates, edits, and soft-deletes a post", async () => {
    const { authorId, subredditId } = await seedUsersAndSubreddit();

    const created = await createPost({
      userId: authorId,
      subredditId,
      title: "Integration post title",
      body: "Body for the integration post",
    });
    expect(created.id).toBeTruthy();

    let row = await getPostRow(created.id);
    expect(row?.title).toBe("Integration post title");
    expect(row?.body).toBe("Body for the integration post");
    expect(row?.is_removed).toBe(0);

    await editPost({
      postId: created.id,
      userId: authorId,
      title: "Edited integration title",
      body: "Edited body",
    });
    row = await getPostRow(created.id);
    expect(row?.title).toBe("Edited integration title");
    expect(row?.body).toBe("Edited body");

    await expect(
      editPost({
        postId: created.id,
        userId: "someone-else",
        title: "Nope",
      })
    ).rejects.toBeInstanceOf(AuthError);

    await softDeletePost(created.id, authorId);
    row = await getPostRow(created.id);
    expect(row?.is_removed).toBe(1);
  });

  it("creates nested comments, edits, likes, and deletes them", async () => {
    const { authorId, actorId, subredditId } = await seedUsersAndSubreddit();

    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Comment thread post",
      body: "Root",
    });

    const parent = await createComment({
      userId: authorId,
      postId: post.id,
      body: "Parent comment",
    });
    expect(parent.depth).toBe(0);

    const child = await createComment({
      userId: actorId,
      postId: post.id,
      parentId: parent.id,
      body: "Child reply",
    });
    expect(child.depth).toBe(1);

    let postRow = await getPostRow(post.id);
    expect(postRow?.comment_count).toBe(2);

    await editComment({
      commentId: parent.id,
      userId: authorId,
      body: "Parent comment edited",
    });
    let comment = await getCommentRow(parent.id);
    expect(comment?.body).toBe("Parent comment edited");

    const like = await likeComment(parent.id, actorId);
    expect(like.liked).toBe(true);
    expect(like.likeCount).toBe(1);
    const repeatedLike = await likeComment(parent.id, actorId);
    expect(repeatedLike.likeCount).toBe(1);
    expect((await getCommentRow(parent.id))?.like_count).toBe(1);

    const unlike = await unlikeComment(parent.id, actorId);
    expect(unlike.liked).toBe(false);
    expect(unlike.likeCount).toBe(0);

    await softDeleteComment(child.id, actorId);
    comment = await getCommentRow(child.id);
    expect(comment?.is_deleted).toBe(1);
    expect(comment?.body).toBe("[deleted]");

    postRow = await getPostRow(post.id);
    expect(postRow?.comment_count).toBe(1);
  });

  it("assigns post likes idempotently", async () => {
    const { authorId, actorId, subredditId } = await seedUsersAndSubreddit();

    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Like target post",
      body: "Please like",
    });

    const liked = await likePost(post.id, actorId);
    expect(liked.liked).toBe(true);
    expect(liked.likeCount).toBe(1);
    expect((await getPostRow(post.id))?.like_count).toBe(1);

    const repeatedLike = await likePost(post.id, actorId);
    expect(repeatedLike.likeCount).toBe(1);
    expect((await getPostRow(post.id))?.like_count).toBe(1);

    const unliked = await unlikePost(post.id, actorId);
    expect(unliked.liked).toBe(false);
    expect(unliked.likeCount).toBe(0);
    expect((await getPostRow(post.id))?.like_count).toBe(0);
  });
  it("returns the same rows for retried post and comment writes", async () => {
    const { authorId, subredditId } = await seedUsersAndSubreddit();
    const postRequestId = crypto.randomUUID();
    const firstPost = await createPost({
      userId: authorId,
      subredditId,
      title: "Retry-safe post",
      body: "The same request must not create two posts.",
      requestId: postRequestId,
    });
    const retriedPost = await createPost({
      userId: authorId,
      subredditId,
      title: "Retry-safe post",
      body: "The same request must not create two posts.",
      requestId: postRequestId,
    });
    expect(retriedPost).toEqual(firstPost);

    const postCount = await env.DB
      .prepare(`SELECT COUNT(*) AS count FROM posts WHERE id = ?`)
      .bind(firstPost.id)
      .first<{ count: number }>();
    expect(Number(postCount?.count)).toBe(1);

    const commentRequestId = crypto.randomUUID();
    const firstComment = await createComment({
      userId: authorId,
      postId: firstPost.id,
      body: "This comment is also retry-safe.",
      requestId: commentRequestId,
    });
    const retriedComment = await createComment({
      userId: authorId,
      postId: firstPost.id,
      body: "This comment is also retry-safe.",
      requestId: commentRequestId,
    });
    expect(retriedComment).toEqual(firstComment);

    const commentCount = await env.DB
      .prepare(`SELECT COUNT(*) AS count FROM comments WHERE id = ?`)
      .bind(firstComment.id)
      .first<{ count: number }>();
    expect(Number(commentCount?.count)).toBe(1);
  });
});


describe("user actions (hide / block / follow / report)", () => {
  it("hides a post from the viewer feed", async () => {
    const { authorId, actorId, subredditId, subredditName } =
      await seedUsersAndSubreddit();

    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Hide me from feeds",
      body: "Secret",
    });

    const before = await getFeedPosts({
      subreddit: subredditName,
      viewerUserId: actorId,
      sort: "new",
      limit: 10,
    });
    expect(before.posts.some((p) => p.id === post.id)).toBe(true);

    await hidePost(actorId, post.id);
    const hidden = await env.DB.prepare(
      `SELECT 1 AS ok FROM hidden_posts WHERE user_id = ? AND post_id = ?`
    )
      .bind(actorId, post.id)
      .first();
    expect(hidden).toBeTruthy();

    const after = await getFeedPosts({
      subreddit: subredditName,
      viewerUserId: actorId,
      sort: "new",
      limit: 10,
    });
    expect(after.posts.some((p) => p.id === post.id)).toBe(false);

    await unhidePost(actorId, post.id);
    const restored = await getFeedPosts({
      subreddit: subredditName,
      viewerUserId: actorId,
      sort: "new",
      limit: 10,
    });
    expect(restored.posts.some((p) => p.id === post.id)).toBe(true);
  });

  it("blocks a user and filters their posts from the feed", async () => {
    const { authorId, actorId, subredditId, subredditName } =
      await seedUsersAndSubreddit();

    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Block author post",
      body: "Bye",
    });

    await followUser(actorId, authorId);
    let follow = await env.DB.prepare(
      `SELECT 1 AS ok FROM user_follows WHERE follower_id = ? AND following_id = ?`
    )
      .bind(actorId, authorId)
      .first();
    expect(follow).toBeTruthy();

    await blockUser(actorId, authorId);
    const block = await env.DB.prepare(
      `SELECT 1 AS ok FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?`
    )
      .bind(actorId, authorId)
      .first();
    expect(block).toBeTruthy();

    // Block also removes the follow edge
    follow = await env.DB.prepare(
      `SELECT 1 AS ok FROM user_follows WHERE follower_id = ? AND following_id = ?`
    )
      .bind(actorId, authorId)
      .first();
    expect(follow).toBeFalsy();

    const feed = await getFeedPosts({
      subreddit: subredditName,
      viewerUserId: actorId,
      sort: "new",
      limit: 10,
    });
    expect(feed.posts.some((p) => p.id === post.id)).toBe(false);

    await unblockUser(actorId, authorId);
    await followUser(actorId, authorId);
    await unfollowUser(actorId, authorId);
  });

  it("reports a post once and rejects duplicates", async () => {
    const { authorId, actorId, subredditId } = await seedUsersAndSubreddit();

    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Reportable post",
      body: "Spammy",
    });

    const result = await reportTarget({
      reporterId: actorId,
      targetType: "post",
      targetId: post.id,
      reason: "spam",
      details: "Looks like spam",
    });
    expect(result.reported).toBe(true);

    await expect(
      reportTarget({
        reporterId: actorId,
        targetType: "post",
        targetId: post.id,
        reason: "spam",
      })
    ).rejects.toBeInstanceOf(AuthError);
  });
});

describe("communities", () => {
  it("creates a community, auto-subscribes, and makes creator a mod", async () => {
    const { adminId } = await seedUsersAndSubreddit();
    const name = `newc_${crypto.randomUUID().slice(0, 6)}`;

    const created = await createSubreddit({
      actor: { id: adminId, role: "admin", status: "active" },
      name,
      title: "Brand new community",
      description: "Integration community",
    });
    expect(created.name).toBe(name);

    const sub = await env.DB.prepare(
      `SELECT 1 AS ok FROM subscriptions WHERE user_id = ? AND subreddit_id = ?`
    )
      .bind(adminId, created.id)
      .first();
    expect(sub).toBeTruthy();

    const mod = await env.DB.prepare(
      `SELECT 1 AS ok FROM subreddit_moderators WHERE user_id = ? AND subreddit_id = ?`
    )
      .bind(adminId, created.id)
      .first();
    expect(mod).toBeTruthy();
  });

  it("rejects community creation by normal users", async () => {
    const { authorId } = await seedUsersAndSubreddit();

    await expect(
      createSubreddit({
        actor: { id: authorId, role: "user", status: "active" },
        name: `user_${crypto.randomUUID().slice(0, 6)}`,
        title: "Should not be created",
      })
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("validation edges", () => {
  it("rejects short titles and self-block", async () => {
    const { authorId, subredditId } = await seedUsersAndSubreddit();

    await expect(
      createPost({
        userId: authorId,
        subredditId,
        title: "ab",
      })
    ).rejects.toBeInstanceOf(AuthError);

    await expect(blockUser(authorId, authorId)).rejects.toBeInstanceOf(
      AuthError
    );
  });
});
