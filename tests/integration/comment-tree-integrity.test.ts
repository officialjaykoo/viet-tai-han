import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import {
  createComment,
  createPost,
  deleteOwnComment,
  deleteOwnPost,
  removeCommentForModeration,
} from "@/lib/actions";
import { MAX_COMMENT_DEPTH } from "@/lib/comment-constants";
import { getPostDetail } from "@/lib/content";
import { deleteAccount } from "@/lib/admin";
import { AuthError } from "@/lib/session";

import { getCommentRow, getPostRow, seedUsersAndSubreddit } from "./helpers";

function expectAuthStatus(error: unknown, status: number) {
  expect(error).toBeInstanceOf(AuthError);
  expect((error as AuthError).status).toBe(status);
}

describe("comment tree integrity (D1)", () => {
  it("allows depths 0, 1, 2 and rejects depth 3 without inserting", async () => {
    const { authorId, actorId, subredditId } = await seedUsersAndSubreddit();
    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Maximum depth post",
      body: "Depth test",
    });

    const root = await createComment({
      userId: authorId,
      postId: post.id,
      body: "Depth zero",
    });
    const first = await createComment({
      userId: actorId,
      postId: post.id,
      parentId: root.id,
      body: "Depth one",
    });
    const second = await createComment({
      userId: authorId,
      postId: post.id,
      parentId: first.id,
      body: "Depth two",
    });

    expect(MAX_COMMENT_DEPTH).toBe(2);
    expect(root.depth).toBe(0);
    expect(first.depth).toBe(1);
    expect(second.depth).toBe(2);

    const rejected = await Promise.allSettled([
      createComment({
        userId: actorId,
        postId: post.id,
        parentId: second.id,
        body: "Depth three must fail",
      }),
    ]);
    expect(rejected[0].status).toBe("rejected");
    if (rejected[0].status === "rejected") {
      expectAuthStatus(rejected[0].reason, 400);
    }

    const overDepth = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM comments WHERE post_id = ? AND depth > ?`
    )
      .bind(post.id, MAX_COMMENT_DEPTH)
      .first<{ count: number }>();
    expect(Number(overDepth?.count ?? 0)).toBe(0);
  });

  it("rejects replies to removed or author-deleted parents", async () => {
    const { authorId, actorId, subredditId } = await seedUsersAndSubreddit();
    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Unavailable parent post",
      body: "Parent state test",
    });

    const deletedParent = await createComment({
      userId: authorId,
      postId: post.id,
      body: "Author deleted parent",
    });
    await deleteOwnComment(deletedParent.id, authorId);
    await expect(
      createComment({
        userId: actorId,
        postId: post.id,
        parentId: deletedParent.id,
        body: "Cannot reply",
      })
    ).rejects.toMatchObject({ status: 404 });

    const removedParent = await createComment({
      userId: authorId,
      postId: post.id,
      body: "Moderated parent",
    });
    await removeCommentForModeration(removedParent.id, actorId);
    await expect(
      createComment({
        userId: actorId,
        postId: post.id,
        parentId: removedParent.id,
        body: "Cannot reply either",
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("keeps a parent and child intact when parent author deletion is attempted", async () => {
    const { authorId, actorId, subredditId } = await seedUsersAndSubreddit();
    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Parent deletion conflict",
      body: "Keep the tree",
    });
    const parent = await createComment({
      userId: authorId,
      postId: post.id,
      body: "Parent",
    });
    const child = await createComment({
      userId: actorId,
      postId: post.id,
      parentId: parent.id,
      body: "Child",
    });

    await expect(deleteOwnComment(parent.id, authorId)).rejects.toMatchObject({
      status: 409,
    });
    expect(await getCommentRow(parent.id)).toMatchObject({
      is_deleted: 0,
      is_removed: 0,
    });
    expect(await getCommentRow(child.id)).toBeTruthy();
    const detail = await getPostDetail(post.id);
    expect(detail?.comments[0]?.id).toBe(parent.id);
    expect(detail?.comments[0]?.children[0]?.id).toBe(child.id);
  });

  it("deletes a leaf without reparenting or changing its parent", async () => {
    const { authorId, actorId, subredditId } = await seedUsersAndSubreddit();
    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Leaf deletion",
      body: "Leaf test",
    });
    const parent = await createComment({
      userId: authorId,
      postId: post.id,
      body: "Parent remains",
    });
    const child = await createComment({
      userId: actorId,
      postId: post.id,
      parentId: parent.id,
      body: "Leaf disappears",
    });

    await deleteOwnComment(child.id, actorId);
    const childRow = await getCommentRow(child.id);
    expect(childRow).toMatchObject({
      is_deleted: 1,
      is_removed: 0,
      body: "[deleted]",
    });
    const relation = await env.DB.prepare(
      `SELECT parent_id FROM comments WHERE id = ?`
    )
      .bind(child.id)
      .first<{ parent_id: string | null }>();
    expect(relation?.parent_id).toBe(parent.id);
    expect((await getPostRow(post.id))?.comment_count).toBe(1);
    expect((await getPostDetail(post.id))?.comments[0]?.children).toHaveLength(
      0
    );
  });

  it("blocks deletion of a middle node and keeps the grandchild attached", async () => {
    const { authorId, actorId, subredditId } = await seedUsersAndSubreddit();
    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Middle deletion conflict",
      body: "Keep descendants",
    });
    const root = await createComment({
      userId: authorId,
      postId: post.id,
      body: "Root",
    });
    const middle = await createComment({
      userId: actorId,
      postId: post.id,
      parentId: root.id,
      body: "Middle",
    });
    const grandchild = await createComment({
      userId: authorId,
      postId: post.id,
      parentId: middle.id,
      body: "Grandchild",
    });

    await expect(deleteOwnComment(middle.id, actorId)).rejects.toMatchObject({
      status: 409,
    });
    const relation = await env.DB.prepare(
      `SELECT parent_id FROM comments WHERE id = ?`
    )
      .bind(grandchild.id)
      .first<{ parent_id: string | null }>();
    expect(relation?.parent_id).toBe(middle.id);
    const detail = await getPostDetail(post.id);
    expect(detail?.comments[0]?.children[0]?.id).toBe(middle.id);
    expect(detail?.comments[0]?.children[0]?.children[0]?.id).toBe(
      grandchild.id
    );
  });

  it("blocks author post deletion when comments exist and allows an empty post", async () => {
    const { authorId, actorId, subredditId } = await seedUsersAndSubreddit();
    const commentedPost = await createPost({
      userId: authorId,
      subredditId,
      title: "Post deletion conflict",
      body: "Has a comment",
    });
    const comment = await createComment({
      userId: actorId,
      postId: commentedPost.id,
      body: "Keep this post",
    });

    await expect(
      deleteOwnPost(commentedPost.id, authorId)
    ).rejects.toMatchObject({ status: 409 });
    expect(await getPostRow(commentedPost.id)).toMatchObject({ is_removed: 0 });
    expect(await getCommentRow(comment.id)).toBeTruthy();

    const emptyPost = await createPost({
      userId: authorId,
      subredditId,
      title: "Empty post deletion",
      body: "No comments",
    });
    await deleteOwnPost(emptyPost.id, authorId);
    expect(await getPostRow(emptyPost.id)).toMatchObject({ is_removed: 1 });
  });

  it("does not promote a child whose parent is absent from the result set", async () => {
    const { authorId, actorId, subredditId } = await seedUsersAndSubreddit();
    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Orphan presentation",
      body: "Hidden parent",
    });
    const parent = await createComment({
      userId: authorId,
      postId: post.id,
      body: "Shadow-hidden parent",
    });
    await createComment({
      userId: actorId,
      postId: post.id,
      parentId: parent.id,
      body: "Child must not become a root",
    });
    await env.DB.prepare(
      `UPDATE comments SET is_shadow_hidden = 1 WHERE id = ?`
    )
      .bind(parent.id)
      .run();

    const detail = await getPostDetail(post.id);
    expect(detail?.comments).toHaveLength(0);
  });

  it("repairs legacy deleted parent flags without reparenting and preserves children", async () => {
    const { authorId, actorId, subredditId } = await seedUsersAndSubreddit();
    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Legacy tombstone repair",
      body: "Legacy flags",
    });
    const parent = await createComment({
      userId: authorId,
      postId: post.id,
      body: "Legacy parent",
    });
    const child = await createComment({
      userId: actorId,
      postId: post.id,
      parentId: parent.id,
      body: "Existing child",
    });

    await env.DB.prepare(
      `UPDATE comments
       SET is_deleted = 1, is_removed = 1, body = '[deleted]'
       WHERE id = ?`
    )
      .bind(parent.id)
      .run();
    await env.DB.prepare(
      `UPDATE comments
       SET is_removed = 0, body = '[deleted]', updated_at = datetime('now')
       WHERE id = ?
         AND is_deleted = 1
         AND is_removed = 1
         AND EXISTS (
           SELECT 1 FROM comments child
           WHERE child.parent_id = comments.id AND child.is_removed = 0
         )`
    )
      .bind(parent.id)
      .run();

    const repaired = await getCommentRow(parent.id);
    expect(repaired).toMatchObject({
      is_deleted: 1,
      is_removed: 0,
      body: "[deleted]",
    });
    const relation = await env.DB.prepare(
      `SELECT parent_id FROM comments WHERE id = ?`
    )
      .bind(child.id)
      .first<{ parent_id: string | null }>();
    expect(relation?.parent_id).toBe(parent.id);
    const detail = await getPostDetail(post.id);
    expect(detail?.comments[0]).toMatchObject({
      id: parent.id,
      isDeleted: true,
      isRemoved: false,
    });
    expect(detail?.comments[0]?.children[0]?.id).toBe(child.id);
  });

  it("keeps moderator tombstones in the tree with their children", async () => {
    const { authorId, actorId, subredditId } = await seedUsersAndSubreddit();
    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Moderator tombstone",
      body: "Preserve replies",
    });
    const parent = await createComment({
      userId: authorId,
      postId: post.id,
      body: "Moderated parent",
    });
    const child = await createComment({
      userId: actorId,
      postId: post.id,
      parentId: parent.id,
      body: "Retained child",
    });

    await removeCommentForModeration(parent.id, actorId);
    const row = await getCommentRow(parent.id);
    expect(row).toMatchObject({
      is_deleted: 0,
      is_removed: 1,
      body: "[removed]",
    });
    const detail = await getPostDetail(post.id);
    expect(detail?.comments[0]).toMatchObject({
      id: parent.id,
      isDeleted: false,
      isRemoved: true,
      body: "[removed]",
    });
    expect(detail?.comments[0]?.children[0]?.id).toBe(child.id);
    expect((await getPostRow(post.id))?.comment_count).toBe(1);
  });

  it("soft-deletes an account and moderation-tombstones its comments", async () => {
    const { adminId, authorId, actorId, subredditId } =
      await seedUsersAndSubreddit();
    const post = await createPost({
      userId: actorId,
      subredditId,
      title: "Account deletion target",
      body: "Comment owner will be deleted",
    });
    const comment = await createComment({
      userId: authorId,
      postId: post.id,
      body: "Account-owned comment",
    });

    await deleteAccount({ actorId: adminId, targetUserId: authorId });
    expect(await getCommentRow(comment.id)).toMatchObject({
      is_deleted: 0,
      is_removed: 1,
      body: "[removed]",
    });
    expect((await getPostRow(post.id))?.comment_count).toBe(0);
    const physicalRow = await env.DB.prepare(
      `SELECT id FROM comments WHERE id = ?`
    )
      .bind(comment.id)
      .first();
    expect(physicalRow?.id).toBe(comment.id);
  });

  it("serializes concurrent reply and parent deletion without an orphan", async () => {
    const { authorId, actorId, subredditId } = await seedUsersAndSubreddit();
    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Concurrent tree mutation",
      body: "One operation must win",
    });
    const parent = await createComment({
      userId: authorId,
      postId: post.id,
      body: "Race parent",
    });

    const outcomes = await Promise.allSettled([
      createComment({
        userId: actorId,
        postId: post.id,
        parentId: parent.id,
        body: "Race reply",
      }),
      deleteOwnComment(parent.id, authorId),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(
      1
    );

    const children = await env.DB.prepare(
      `SELECT id, parent_id FROM comments WHERE parent_id = ?`
    )
      .bind(parent.id)
      .all<{ id: string; parent_id: string }>();
    const parentRow = await getCommentRow(parent.id);
    if ((children.results ?? []).length > 0) {
      expect(parentRow).toMatchObject({ is_deleted: 0, is_removed: 0 });
      expect((children.results ?? [])[0]?.parent_id).toBe(parent.id);
    } else {
      expect(parentRow).toMatchObject({ is_deleted: 1, is_removed: 0 });
    }
  });

  it("keeps legacy depth-three relationships readable", async () => {
    const { authorId, actorId, subredditId } = await seedUsersAndSubreddit();
    const post = await createPost({
      userId: authorId,
      subredditId,
      title: "Legacy deep thread",
      body: "Read without truncation",
    });
    const root = await createComment({
      userId: authorId,
      postId: post.id,
      body: "Root",
    });
    const first = await createComment({
      userId: actorId,
      postId: post.id,
      parentId: root.id,
      body: "First",
    });
    const second = await createComment({
      userId: authorId,
      postId: post.id,
      parentId: first.id,
      body: "Second",
    });
    const legacyId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO comments (id, post_id, author_id, parent_id, body, depth)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(legacyId, post.id, actorId, second.id, "Legacy depth three", 3)
      .run();

    const detail = await getPostDetail(post.id);
    expect(detail?.comments[0]?.children[0]?.children[0]?.children[0]).toMatchObject(
      {
        id: legacyId,
        depth: 3,
      }
    );
  });
});
