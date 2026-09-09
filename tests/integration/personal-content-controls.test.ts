import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { getPostDetail, getRecommendations } from "@/lib/content";
import { getFeedPosts } from "@/lib/db";
import { createNotification, listNotifications } from "@/lib/notifications";
import { listSavedPosts, setPostSaved } from "@/lib/post-saves";
import { searchAll } from "@/lib/search";
import { muteUser, unmuteUser } from "@/lib/user-actions";
import { seedUsersAndSubreddit } from "./helpers";

describe("personal content controls (D1)", () => {
  it("keeps saves private, idempotent, and independent from engagement", async () => {
    const { authorId, actorId, subredditId } = await seedUsersAndSubreddit();
    const postId = `saved_post_${crypto.randomUUID()}`;
    await env.DB.prepare(
      `INSERT INTO posts (id, subreddit_id, author_id, title, body, like_count, comment_count)
       VALUES (?, ?, ?, 'Saved control post', 'save control body', 4, 2)`
    )
      .bind(postId, subredditId, authorId)
      .run();

    await expect(setPostSaved({ userId: actorId, postId, saved: true })).resolves.toEqual({
      postId,
      saved: true,
    });
    await setPostSaved({ userId: actorId, postId, saved: true });
    const savedCount = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM post_saves WHERE user_id = ? AND post_id = ?`
    )
      .bind(actorId, postId)
      .first<{ count: number }>();
    const postBefore = await env.DB.prepare(
      `SELECT like_count, comment_count FROM posts WHERE id = ?`
    )
      .bind(postId)
      .first<{ like_count: number; comment_count: number }>();

    expect(Number(savedCount?.count ?? 0)).toBe(1);
    expect(postBefore).toEqual({ like_count: 4, comment_count: 2 });
    expect((await listSavedPosts(actorId)).map((post) => post.id)).toContain(postId);
    await setPostSaved({ userId: actorId, postId, saved: false });
    await setPostSaved({ userId: actorId, postId, saved: false });
    const unsavedCount = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM post_saves WHERE user_id = ? AND post_id = ?`
    )
      .bind(actorId, postId)
      .first<{ count: number }>();
    expect(Number(unsavedCount?.count ?? 0)).toBe(0);
    await setPostSaved({ userId: actorId, postId, saved: true });
    await env.DB.prepare(`UPDATE posts SET is_removed = 1 WHERE id = ?`)
      .bind(postId)
      .run();
    expect((await listSavedPosts(actorId)).map((post) => post.id)).not.toContain(postId);
  });

  it("hides muted authors only from discovery and ordinary notifications", async () => {
    const { authorId, actorId, subredditId } = await seedUsersAndSubreddit();
    const postId = `muted_post_${crypto.randomUUID()}`;
    await env.DB.prepare(
      `INSERT INTO posts (id, subreddit_id, author_id, title, body)
       VALUES (?, ?, ?, 'Muted discovery post', 'muted discovery body')`
    )
      .bind(postId, subredditId, authorId)
      .run();
    await setPostSaved({ userId: actorId, postId, saved: true });
    await muteUser(actorId, authorId);

    const feed = await getFeedPosts({
      mode: "popular",
      sort: "popular",
      window: "all",
      viewerUserId: actorId,
    });
    expect(feed.posts.map((post) => post.id)).not.toContain(postId);
    expect((await searchAll("Muted discovery", {}, actorId)).posts.map((post) => post.id)).not.toContain(postId);
    expect(
      (await searchAll("author_", {}, actorId)).accounts.map((account) => account.username)
    ).not.toContain(`author_${actorId.split("_").at(-1)}`);
    expect((await getRecommendations(actorId)).map((post) => post.id)).not.toContain(postId);
    expect((await listSavedPosts(actorId)).map((post) => post.id)).toContain(postId);
    expect(await getPostDetail(postId, actorId)).toMatchObject({ id: postId });

    await expect(
      createNotification({
        userId: actorId,
        actorId: authorId,
        kind: "comment_on_post",
        title: "Muted author notification",
      })
    ).resolves.toBeNull();
    expect(
      (await listNotifications(actorId)).filter(
        (notification) => notification.title === "Muted author notification"
      )
    ).toHaveLength(0);

    await unmuteUser(actorId, authorId);
    expect(
      (await getFeedPosts({
        mode: "popular",
        sort: "popular",
        window: "all",
        viewerUserId: actorId,
      })).posts.map((post) => post.id)
    ).toContain(postId);
  });
  it("applies UTC popular windows without changing the rank formula", async () => {
    const { authorId, subredditId } = await seedUsersAndSubreddit();
    const recentId = `window_recent_${crypto.randomUUID()}`;
    const oldId = `window_old_${crypto.randomUUID()}`;
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO posts (
           id, subreddit_id, author_id, title, body, like_count, comment_count, created_at
         ) VALUES (?, ?, ?, 'Recent window post', 'body', 2, 1, datetime('now'))`
      ).bind(recentId, subredditId, authorId),
      env.DB.prepare(
        `INSERT INTO posts (
           id, subreddit_id, author_id, title, body, like_count, comment_count, created_at
         ) VALUES (?, ?, ?, 'Old window post', 'body', 20, 0, datetime('now', '-2 days'))`
      ).bind(oldId, subredditId, authorId),
    ]);

    const today = await getFeedPosts({
      mode: "popular",
      sort: "popular",
      window: "day",
    });
    expect(today.posts.map((post) => post.id)).toContain(recentId);
    expect(today.posts.map((post) => post.id)).not.toContain(oldId);

    const allTime = await getFeedPosts({
      mode: "popular",
      sort: "popular",
      window: "all",
    });
    expect(allTime.posts.map((post) => post.id)).toEqual(
      expect.arrayContaining([recentId, oldId])
    );
    expect(allTime.posts.find((post) => post.id === oldId)?.likeCount).toBe(20);
  });
});
