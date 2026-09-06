import { describe, expect, it } from "vitest";

import { getProfileHref } from "@/lib/profile-url";

describe("getProfileHref", () => {
  it("uses the username for canonical profile URLs", () => {
    expect(getProfileHref({ id: "user-1", username: "jay_koo" })).toBe(
      "/u/jay_koo"
    );
  });

  it("uses the user id when a social account has no username", () => {
    expect(getProfileHref({ id: "social-user-1", username: null })).toBe(
      "/u/social-user-1"
    );
  });

  it("keeps signed-out navigation on the login page", () => {
    expect(getProfileHref(null)).toBe("/login");
  });
});
