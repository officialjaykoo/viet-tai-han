import { describe, expect, it } from "vitest";

import {
  isProfileCommunityName,
  parseProfileCommunityName,
  profileCommunityName,
} from "@/lib/profile-community-name";

describe("profile community helpers", () => {
  it("builds and parses personal community names", () => {
    expect(profileCommunityName("Alice")).toBe("u_alice");
    expect(parseProfileCommunityName("u_alice")).toBe("alice");
    expect(isProfileCommunityName("u_alice")).toBe(true);
    expect(isProfileCommunityName("programming")).toBe(false);
  });
});
