import { describe, expect, it } from "vitest";

import { getSafeAuthNext } from "@/lib/auth-redirect";

describe("auth redirect targets", () => {
  it("keeps internal paths and their query strings", () => {
    expect(getSafeAuthNext("/messages?room=room-1")).toBe(
      "/messages?room=room-1"
    );
  });

  it("rejects external, protocol-relative, and backslash targets", () => {
    expect(getSafeAuthNext("https://example.com")).toBe("/");
    expect(getSafeAuthNext("//example.com")).toBe("/");
    expect(getSafeAuthNext("/\\evil.example")).toBe("/");
  });

  it("does not loop between auth routes", () => {
    expect(getSafeAuthNext("/login?next=/messages")).toBe("/");
    expect(getSafeAuthNext("/signup")).toBe("/");
  });

  it("accepts the first value of a repeated next parameter", () => {
    expect(getSafeAuthNext(["/settings", "/admin"])).toBe("/settings");
  });
});
