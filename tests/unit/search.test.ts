import { describe, expect, it } from "vitest";

import { likeContains, normalizeSearchQuery } from "@/lib/search";

describe("search helpers", () => {
  it("trims and caps query length", () => {
    expect(normalizeSearchQuery("  hello  ")).toBe("hello");
    expect(normalizeSearchQuery("x".repeat(100)).length).toBe(80);
  });

  it("escapes LIKE wildcards", () => {
    expect(likeContains("100%_off")).toBe("%100\\%\\_off%");
  });
});
