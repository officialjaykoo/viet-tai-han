import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { listUserCommentsPage } from "@/lib/content";

async function insertUser(userId: string, username: string) {
  await env.DB.prepare(
    `INSERT INTO "user" (id, name, email, emailVerified, username, role, status)
     VALUES (?, 'Profile Activity User', ?, 1, ?, 'user', 'active')`
  )
    .bind(userId, `${userId}@profile.test`, username)
    .run();
}

describe("profile activity pagination", () => {
  it("exposes comments beyond the first page with a signed cursor", async () => {
    const authorId = `profile_activity_${crypto.randomUUID()}`;
    const authorUsername = `profile_activity_${crypto.randomUUID().slice(0, 8)}`;
    const subredditId = `profile_activity_sub_${crypto.randomUUID()}`;
    const postId = `profile_activity_post_${crypto.randomUUID()}`;
    await insertUser(authorId, authorUsername);
    await env.DB.prepare(
      `INSERT INTO subreddits (id, name, title, created_by)
       VALUES (?, ?, 'Profile activity pagination', ?)`
    )
      .bind(
        subredditId,
        `profile_activity_${crypto.randomUUID().slice(0, 8)}`,
        authorId
      )
      .run();
    await env.DB.prepare(
      `INSERT INTO posts (id, subreddit_id, author_id, title, body)
       VALUES (?, ?, ?, 'Profile activity post', 'body')`
    )
      .bind(postId, subredditId, authorId)
      .run();

    const expectedIds: string[] = [];
    for (let index = 0; index < 31; index += 1) {
      const commentId = `profile_activity_comment_${String(index).padStart(2, "0")}_${crypto.randomUUID()}`;
      expectedIds.push(commentId);
      await env.DB.prepare(
        `INSERT INTO comments (id, post_id, author_id, body, created_at)
         VALUES (?, ?, ?, ?, datetime('now', ? || ' seconds'))`
      )
        .bind(commentId, postId, authorId, `comment ${index}`, String(-index))
        .run();
    }

    const collected: string[] = [];
    let cursor: string | null = null;
    for (;;) {
      const page = await listUserCommentsPage(authorId, {
        limit: 10,
        cursor,
      });
      collected.push(...page.comments.map((comment) => comment.id));
      if (!page.hasMore) break;
      expect(page.nextCursor).toEqual(expect.any(String));
      cursor = page.nextCursor;
    }

    expect(collected).toHaveLength(31);
    expect(new Set(collected).size).toBe(31);
    expect(collected.sort()).toEqual(expectedIds.sort());
  });
});
