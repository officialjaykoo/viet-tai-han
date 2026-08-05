import { describe, expect, it } from "vitest";

import {
  InvalidFeedCursorError,
  openFeedCursorWithSecret,
  signFeedCursorWithSecret,
  type FeedCursorContext,
} from "@/lib/security/feed-cursor";

const secret = new TextEncoder().encode("test-feed-cursor-secret");

const ctx: FeedCursorContext = {
  sort: "hot",
  mode: "popular",
  subreddit: null,
  authorId: null,
  viewerId: null,
};

describe("signed feed cursor", () => {
  it("round-trips a valid cursor", async () => {
    const token = await signFeedCursorWithSecret(
      secret,
      { createdAt: "2026-01-01 12:00:00", id: "post_abc", score: 12 },
      ctx
    );
    expect(token.startsWith("fc1.")).toBe(true);
    const opened = await openFeedCursorWithSecret(secret, token, ctx);
    expect(opened).toEqual({
      createdAt: "2026-01-01 12:00:00",
      id: "post_abc",
      score: 12,
    });
  });

  it("rejects tampered payloads", async () => {
    const token = await signFeedCursorWithSecret(
      secret,
      { createdAt: "2026-01-01 12:00:00", id: "post_abc" },
      ctx
    );
    const parts = token.split(".");
    const mangled = `${parts[0]}.${parts[1]}.${(parts[2] ?? "") + "aa"}`;
    await expect(
      openFeedCursorWithSecret(secret, mangled, ctx)
    ).rejects.toBeInstanceOf(InvalidFeedCursorError);
  });

  it("rejects unsigned legacy cursors", async () => {
    const legacy = btoa(
      JSON.stringify({ createdAt: "2026-01-01 12:00:00", id: "x" })
    );
    await expect(
      openFeedCursorWithSecret(secret, legacy, ctx)
    ).rejects.toBeInstanceOf(InvalidFeedCursorError);
  });

  it("rejects context mismatches and expiry", async () => {
    const now = 1_700_000_000_000;
    const token = await signFeedCursorWithSecret(
      secret,
      { createdAt: "2026-01-01 12:00:00", id: "post_abc" },
      ctx,
      60_000,
      now
    );
    await expect(
      openFeedCursorWithSecret(secret, token, { ...ctx, sort: "top" }, now)
    ).rejects.toBeInstanceOf(InvalidFeedCursorError);
    await expect(
      openFeedCursorWithSecret(secret, token, ctx, now + 120_000)
    ).rejects.toBeInstanceOf(InvalidFeedCursorError);
  });

  it("returns null for empty cursor", async () => {
    expect(await openFeedCursorWithSecret(secret, null, ctx)).toBeNull();
  });
});
