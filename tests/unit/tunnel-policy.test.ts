import { describe, expect, it } from "vitest";

import { isAtkOnlyMutation } from "@/lib/security/tunnel-policy";

describe("ATK-only tunnel mutations", () => {
  it("allows only POST auth sign-out", () => {
    expect(isAtkOnlyMutation("POST", "/api/auth/sign-out")).toBe(true);
  });

  it("keeps every other mutation on the challenge-backed path", () => {
    expect(isAtkOnlyMutation("GET", "/api/auth/sign-out")).toBe(false);
    expect(isAtkOnlyMutation("POST", "/api/auth/sign-in/social")).toBe(false);
    expect(isAtkOnlyMutation("POST", "/api/posts")).toBe(false);
    expect(isAtkOnlyMutation("PATCH", "/api/auth/sign-out")).toBe(false);
  });
});
