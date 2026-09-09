import { describe, expect, it } from "vitest";

import {
  InvalidFeedCursorError,
  openFeedCursorWithSecret,
  signFeedCursorWithSecret,
  type FeedCursorContext,
} from "@/lib/security/feed-cursor";

const secret = new TextEncoder().encode("test-feed-cursor-secret");

const ctx: FeedCursorContext = {
  sort: "new",
  mode: "popular",
  subreddit: null,
  authorId: null,
  viewerId: null,
};

describe("signed feed cursor", () => {
  it("round-trips a valid cursor", async () => {
    const token = await signFeedCursorWithSecret(
      secret,
      { createdAt: "2026-01-01 12:00:00", id: "post_abc" },
      ctx
    );
    expect(token.startsWith("fc1.")).toBe(true);
    const opened = await openFeedCursorWithSecret(secret, token, ctx);
    expect(opened).toEqual({
      createdAt: "2026-01-01 12:00:00",
      id: "post_abc",
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
      openFeedCursorWithSecret(secret, token, { ...ctx, mode: "home" }, now)
    ).rejects.toBeInstanceOf(InvalidFeedCursorError);
    await expect(
      openFeedCursorWithSecret(secret, token, ctx, now + 120_000)
    ).rejects.toBeInstanceOf(InvalidFeedCursorError);
  });
  it("round-trips the rank position for popular feeds", async () => {
    const popularContext: FeedCursorContext = {
      ...ctx,
      sort: "popular",
    };
    const token = await signFeedCursorWithSecret(
      secret,
      { rank: 7, createdAt: "2026-01-01 12:00:00", id: "post_ranked" },
      popularContext
    );
    await expect(
      openFeedCursorWithSecret(secret, token, popularContext)
    ).resolves.toEqual({
      rank: 7,
      createdAt: "2026-01-01 12:00:00",
      id: "post_ranked",
    });

    const legacyPopularToken = await signFeedCursorWithSecret(
      secret,
      { createdAt: "2026-01-01 12:00:00", id: "post_legacy" },
      popularContext
    );
    await expect(
      openFeedCursorWithSecret(secret, legacyPopularToken, popularContext)
    ).rejects.toBeInstanceOf(InvalidFeedCursorError);
  });

  it("binds popular cursors to the selected time window", async () => {
    const popularContext: FeedCursorContext = {
      ...ctx,
      sort: "popular",
      popularWindow: "week",
      windowStart: "2026-01-05 00:00:00",
    };
    const token = await signFeedCursorWithSecret(
      secret,
      { rank: 4, createdAt: "2026-01-08 12:00:00", id: "post_window" },
      popularContext
    );
    await expect(
      openFeedCursorWithSecret(secret, token, {
        ...popularContext,
        popularWindow: "month",
        windowStart: "2026-01-01 00:00:00",
      })
    ).rejects.toBeInstanceOf(InvalidFeedCursorError);
  });
  it("returns null for empty cursor", async () => {
    expect(await openFeedCursorWithSecret(secret, null, ctx)).toBeNull();
  });
});
