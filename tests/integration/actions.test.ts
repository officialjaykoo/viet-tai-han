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
  voteOnComment,
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
import { voteOnPost } from "@/lib/votes";

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

  it("creates nested comments, edits, votes, and deletes them", async () => {
    const { authorId, voterId, subredditId } = await seedUsersAndSubreddit();

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
      userId: voterId,
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

    const vote = await voteOnComment({
      commentId: parent.id,
      userId: voterId,
      voterKarma: 40,
      action: "upvote",
    });
    expect(vote.viewerVote).toBe("upvote");
    comment = await getCommentRow(parent.id);
    expect(comment?.score).toBeGreaterThan(0);

    await softDeleteComment(child.id, voterId);
    comment = await getCommentRow(child.id);
    expect(comment?.is_deleted).toBe(1);
    expect(comment?.body).toBe("[deleted]");

    postRow = await getPostRow(post.id);
    expect(postRow?.comment_count).toBe(1);
  });

  it("assigns post ratings via voteOnPost", async () => {
    const { authorId, voterId, subredditId } = await seedUsersAndSubreddit();

    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Vote target post",
      body: "Please rate",
    });

    const up = await voteOnPost(post.id, "upvote", {
      userId: voterId,
      voterKarma: 500,
    });
    expect(up.viewerVote).toBe("upvote");

    let row = await getPostRow(post.id);
    expect(row?.upvotes).toBe(1);
    // Score is stored in millipoints (100 ≈ 1 display point).
    expect(row?.score).toBeGreaterThan(0);
    expect(up.score).toBe(Math.round((row?.score ?? 0) / 100));

    const down = await voteOnPost(post.id, "downvote", {
      userId: voterId,
      voterKarma: 500,
    });
    expect(down.viewerVote).toBe("downvote");

    row = await getPostRow(post.id);
    expect(row?.downvotes).toBe(1);
    expect(row?.upvotes).toBe(0);

    const voteRow = await env.DB.prepare(
      `SELECT value FROM votes
       WHERE user_id = ? AND target_type = 'post' AND target_id = ?`
    )
      .bind(voterId, post.id)
      .first<{ value: number }>();
    expect(voteRow?.value).toBe(-1);
  });
});

describe("user actions (hide / block / follow / report)", () => {
  it("hides a post from the viewer feed", async () => {
    const { authorId, voterId, subredditId, subredditName } =
      await seedUsersAndSubreddit();

    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Hide me from feeds",
      body: "Secret",
    });

    const before = await getFeedPosts({
      subreddit: subredditName,
      viewerUserId: voterId,
      sort: "new",
      limit: 10,
    });
    expect(before.posts.some((p) => p.id === post.id)).toBe(true);

    await hidePost(voterId, post.id);
    const hidden = await env.DB.prepare(
      `SELECT 1 AS ok FROM hidden_posts WHERE user_id = ? AND post_id = ?`
    )
      .bind(voterId, post.id)
      .first();
    expect(hidden).toBeTruthy();

    const after = await getFeedPosts({
      subreddit: subredditName,
      viewerUserId: voterId,
      sort: "new",
      limit: 10,
    });
    expect(after.posts.some((p) => p.id === post.id)).toBe(false);

    await unhidePost(voterId, post.id);
    const restored = await getFeedPosts({
      subreddit: subredditName,
      viewerUserId: voterId,
      sort: "new",
      limit: 10,
    });
    expect(restored.posts.some((p) => p.id === post.id)).toBe(true);
  });

  it("blocks a user and filters their posts from the feed", async () => {
    const { authorId, voterId, subredditId, subredditName } =
      await seedUsersAndSubreddit();

    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Block author post",
      body: "Bye",
    });

    await followUser(voterId, authorId);
    let follow = await env.DB.prepare(
      `SELECT 1 AS ok FROM user_follows WHERE follower_id = ? AND following_id = ?`
    )
      .bind(voterId, authorId)
      .first();
    expect(follow).toBeTruthy();

    await blockUser(voterId, authorId);
    const block = await env.DB.prepare(
      `SELECT 1 AS ok FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?`
    )
      .bind(voterId, authorId)
      .first();
    expect(block).toBeTruthy();

    // Block also removes the follow edge
    follow = await env.DB.prepare(
      `SELECT 1 AS ok FROM user_follows WHERE follower_id = ? AND following_id = ?`
    )
      .bind(voterId, authorId)
      .first();
    expect(follow).toBeFalsy();

    const feed = await getFeedPosts({
      subreddit: subredditName,
      viewerUserId: voterId,
      sort: "new",
      limit: 10,
    });
    expect(feed.posts.some((p) => p.id === post.id)).toBe(false);

    await unblockUser(voterId, authorId);
    await followUser(voterId, authorId);
    await unfollowUser(voterId, authorId);
  });

  it("reports a post once and rejects duplicates", async () => {
    const { authorId, voterId, subredditId } = await seedUsersAndSubreddit();

    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Reportable post",
      body: "Spammy",
    });

    const result = await reportTarget({
      reporterId: voterId,
      targetType: "post",
      targetId: post.id,
      reason: "spam",
      details: "Looks like spam",
    });
    expect(result.reported).toBe(true);

    await expect(
      reportTarget({
        reporterId: voterId,
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
