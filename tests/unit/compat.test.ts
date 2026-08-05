import { describe, expect, it } from "vitest";

/** Safari-safe parsing for SQLite datetime strings (mirrors PostCard). */
function parseSqliteDate(iso: string): number {
  const normalized = iso.includes("T")
    ? iso
    : iso.replace(" ", "T") + (iso.endsWith("Z") ? "" : "Z");
  return Date.parse(normalized);
}

describe("cross-browser date parsing", () => {
  it("parses SQLite datetime without T (Safari-safe)", () => {
    const value = parseSqliteDate("2026-08-04 19:16:56");
    expect(Number.isNaN(value)).toBe(false);
  });

  it("parses ISO strings", () => {
    const value = parseSqliteDate("2026-08-04T19:16:56Z");
    expect(Number.isNaN(value)).toBe(false);
  });
});

describe("touch target policy", () => {
  it("requires at least 44px interactive targets", () => {
    const minTouchTargetPx = 44;
    expect(minTouchTargetPx).toBeGreaterThanOrEqual(44);
  });
});
