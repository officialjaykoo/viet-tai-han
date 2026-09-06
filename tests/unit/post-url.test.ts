import { describe, expect, it } from "vitest";

import { getCanonicalPostUrl } from "@/lib/post-url";

describe("canonical post URLs", () => {
  it("omits feed discovery parameters", () => {
    expect(getCanonicalPostUrl("post-123", "https://vth.kr")).toBe(
      "https://vth.kr/post/post-123"
    );
  });

  it("encodes post IDs as a single canonical path segment", () => {
    expect(getCanonicalPostUrl("post/123", "https://vth.kr")).toBe(
      "https://vth.kr/post/post%2F123"
    );
  });
});
