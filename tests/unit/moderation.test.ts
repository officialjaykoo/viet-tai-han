import { describe, expect, it } from "vitest";

import { findBannedWordHits } from "@/lib/moderation";
import { slugifySubreddit } from "@/lib/permissions";

describe("findBannedWordHits", () => {
  const words = [
    { word: "spamlink", severity: "block" as const },
    { word: "shadownuke", severity: "shadow" as const },
    { word: "bad phrase", severity: "block" as const },
  ];

  it("matches whole tokens for single words", () => {
    const hits = findBannedWordHits("this has a spamlink inside", words);
    expect(hits.map((h) => h.word)).toEqual(["spamlink"]);
  });

  it("does not match partial tokens", () => {
    const hits = findBannedWordHits("nospamlinkhere", words);
    expect(hits).toHaveLength(0);
  });

  it("matches multi-word phrases as substrings", () => {
    const hits = findBannedWordHits("contains a bad phrase today", words);
    expect(hits.some((h) => h.word === "bad phrase")).toBe(true);
  });
});

describe("slugifySubreddit", () => {
  it("normalizes names", () => {
    expect(slugifySubreddit(" Hello World! ")).toBe("hello_world");
  });

  it("trims length", () => {
    expect(slugifySubreddit("a".repeat(40)).length).toBeLessThanOrEqual(32);
  });
});
