import { describe, expect, it } from "vitest";

import {
  isCustomAvatarUrl,
  normalizeAvatarImage,
  normalizeOAuthAvatarImage,
  resolveAvatarSrc,
} from "@/lib/avatar";

describe("avatar URL policy", () => {
  it("normalizes trusted OAuth Kakao CDN URLs separately", () => {
    expect(
      normalizeOAuthAvatarImage(
        "http://t1.kakaocdn.net/account_images/default_profile.jpeg"
      )
    ).toBe(
      "https://t1.kakaocdn.net/account_images/default_profile.jpeg"
    );
  });

  it("accepts only generated or media-backed user avatar values", () => {
    expect(normalizeAvatarImage("generated:abcdefgh")).toBe(
      "generated:abcdefgh"
    );
    expect(normalizeAvatarImage("/api/media/media/abcdefgh.jpg")).toBe(
      "/api/media/media/abcdefgh.jpg"
    );
  });

  it("rejects remote, auth, traversal, and malformed media values", () => {
    for (const value of [
      "https://images.example/avatar.png",
      "http://t1.kakaocdn.net/account_images/default_profile.jpeg",
      "//attacker.example/avatar.png",
      "/api/auth/session",
      "/api/media/avatar.png",
      "/api/media/media_123.jpg",
      "../media/media_12345678.jpg",
    ]) {
      expect(normalizeAvatarImage(value)).toBeNull();
    }
  });

  it("rejects insecure external URLs", () => {
    expect(normalizeAvatarImage("http://images.example/avatar.png")).toBeNull();
    expect(isCustomAvatarUrl("http://images.example/avatar.png")).toBe(false);
  });

  it("renders existing trusted OAuth URLs and rejects unsafe values", () => {
    expect(
      resolveAvatarSrc("https://images.example/avatar.png", "alice").kind
    ).toBe("url");
    const resolved = resolveAvatarSrc("http://images.example/avatar.png", "alice");
    expect(resolved.kind).toBe("generated");
    expect(resolved.src).toMatch(/^data:image\/svg\+xml;utf8,/);
  });
});
