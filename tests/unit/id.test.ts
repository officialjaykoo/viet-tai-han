import { describe, expect, it } from "vitest";

import { createPublicId, isPublicId, PUBLIC_ID_LENGTH } from "@/lib/id";

describe("createPublicId", () => {
  it("returns YouTube-length opaque tokens", () => {
    const id = createPublicId();
    expect(id).toHaveLength(PUBLIC_ID_LENGTH);
    expect(isPublicId(id)).toBe(true);
  });

  it("does not look sequential across calls", () => {
    const ids = new Set(Array.from({ length: 20 }, () => createPublicId()));
    expect(ids.size).toBe(20);
  });

  it("rejects obvious sequential patterns", () => {
    expect(isPublicId("post_001")).toBe(false);
    expect(isPublicId("cmt_001")).toBe(false);
    expect(isPublicId("k7Qm2xR9pLw")).toBe(true);
  });
});
