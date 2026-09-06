import { describe, expect, it } from "vitest";

import {
  formatUserHandle,
  getProfileHref,
  getUsernameProfileHref,
} from "@/lib/profile-url";

describe("getProfileHref", () => {
  it("uses the username for canonical profile URLs", () => {
    expect(getProfileHref({ id: "user-1", username: "jay_koo" })).toBe(
      "/u/jay_koo"
    );
  });

  it("sends an account without a public username to onboarding", () => {
    expect(getProfileHref({ id: "social-user-1", username: null })).toBe(
      "/onboarding"
    );
  });

  it("keeps signed-out navigation on the login page", () => {
    expect(getProfileHref(null)).toBe("/login");
  });
});

describe("profile handle helpers", () => {
  it("formats display handles independently from route URLs", () => {
    expect(formatUserHandle("jay_koo")).toBe("@jay_koo");
    expect(getUsernameProfileHref("jay_koo")).toBe("/u/jay_koo");
  });

  it("does not emit Reddit-style display handles", () => {
    expect(formatUserHandle(null)).toBe("Someone");
    expect(formatUserHandle("")).toBe("Someone");
  });
});
