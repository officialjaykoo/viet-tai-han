import { env, runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("PostObject", () => {
  it("buffers upvotes and flushes to D1 on alarm", async () => {
    await env.DB.prepare(
      `INSERT INTO "user" (id, name, email, emailVerified, username)
       VALUES ('u1', 'Tester', 't@example.local', 1, 'tester')`
    ).run();

    await env.DB.prepare(
      `INSERT INTO subreddits (id, name, title, created_by)
       VALUES ('s1', 'test', 'Test', 'u1')`
    ).run();

    await env.DB.prepare(
      `INSERT INTO posts (id, subreddit_id, author_id, title, upvotes, downvotes, score)
       VALUES ('p1', 's1', 'u1', 'Hello', 0, 0, 0)`
    ).run();

    const stub = env.POST_OBJECT.getByName("p1");
    const afterVote = await stub.vote("upvote", "p1");

    expect(afterVote.upvotes).toBe(1);
    expect(afterVote.pendingFlush).toBe(true);

    const beforeFlush = await env.DB.prepare(
      `SELECT upvotes, score FROM posts WHERE id = 'p1'`
    ).first<{ upvotes: number; score: number }>();
    expect(beforeFlush?.upvotes).toBe(0);

    await runDurableObjectAlarm(stub);

    const afterFlush = await env.DB.prepare(
      `SELECT upvotes, score FROM posts WHERE id = 'p1'`
    ).first<{ upvotes: number; score: number }>();

    expect(afterFlush?.upvotes).toBe(1);
    expect(afterFlush?.score).toBe(1);
  });
});
