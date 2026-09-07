import { describe, expect, it } from "vitest";

import {
  createPublicId,
  generateBase62Id,
  generateUserId,
  isBase62Id,
  isPublicId,
  PUBLIC_ID_LENGTH,
} from "@/lib/id";

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

describe("generateUserId", () => {
  it("returns unique 16-character Base62 IDs", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateUserId()));
    expect(ids.size).toBe(1000);
    expect([...ids].every((id) => isBase62Id(id, 16))).toBe(true);
  });

  it("supports the Better Auth fallback size", () => {
    expect(isBase62Id(generateBase62Id(), 32)).toBe(true);
  });
});
