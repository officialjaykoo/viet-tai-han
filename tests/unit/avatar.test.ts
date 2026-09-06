import { describe, expect, it } from "vitest";

import {
  isCustomAvatarUrl,
  normalizeAvatarImage,
  resolveAvatarSrc,
} from "@/lib/avatar";

describe("avatar URL policy", () => {
  it("upgrades Kakao CDN URLs to HTTPS", () => {
    expect(
      normalizeAvatarImage(
        "http://t1.kakaocdn.net/account_images/default_profile.jpeg"
      )
    ).toBe(
      "https://t1.kakaocdn.net/account_images/default_profile.jpeg"
    );
  });

  it("keeps HTTPS and local avatar URLs unchanged", () => {
    expect(normalizeAvatarImage("https://images.example/avatar.png")).toBe(
      "https://images.example/avatar.png"
    );
    expect(normalizeAvatarImage("/api/media/avatar.png")).toBe(
      "/api/media/avatar.png"
    );
  });

  it("rejects insecure external URLs", () => {
    expect(normalizeAvatarImage("http://images.example/avatar.png")).toBeNull();
    expect(isCustomAvatarUrl("http://images.example/avatar.png")).toBe(false);
  });

  it("renders rejected URLs as generated avatars", () => {
    const resolved = resolveAvatarSrc("http://images.example/avatar.png", "alice");
    expect(resolved.kind).toBe("generated");
    expect(resolved.src).toMatch(/^data:image\/svg\+xml;utf8,/);
  });
});
