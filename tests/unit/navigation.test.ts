import { describe, expect, it } from "vitest";

import {
  isNavSectionActive,
  navSectionForPath,
} from "@/lib/navigation";

describe("consumer navigation mapping", () => {
  it.each([
    ["/", "home"],
    ["/communities", "communities"],
    ["/r/viet", "communities"],
    ["/questions/123", "questions"],
    ["/marketplace/saved", "marketplace"],
    ["/businesses/example/edit", "businesses"],
    ["/messages", "messages"],
    ["/notifications", "notifications"],
    ["/u/jay", "profile"],
  ] as const)("maps %s to %s", (pathname, section) => {
    expect(navSectionForPath(pathname)).toBe(section);
  });

  it("keeps the canonical home route active", () => {
    expect(isNavSectionActive("/", "home")).toBe(true);
    expect(navSectionForPath("/")).toBe("home");
    expect(isNavSectionActive("/questions", "home")).toBe(false);
  });

  it("marks detail and nested consumer routes in the same section", () => {
    expect(isNavSectionActive("/questions/123", "questions")).toBe(true);
    expect(isNavSectionActive("/marketplace/123", "marketplace")).toBe(true);
    expect(isNavSectionActive("/r/viet/submit", "communities")).toBe(true);
    expect(isNavSectionActive("/u/jay", "profile")).toBe(true);
  });
});
