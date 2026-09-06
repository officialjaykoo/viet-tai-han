import { describe, expect, it } from "vitest";

import {
  createSyntheticOAuthEmail,
  isSyntheticOAuthEmail,
  mapOAuthEmail,
  mapOAuthProfile,
  stripOAuthCompatibilityFields,
} from "@/lib/oauth-identity";

describe("social OAuth identity email mapping", () => {
  it("allows Kakao accounts without email", () => {
    const mapped = mapOAuthEmail({
      providerId: "kakao",
      accountId: "123456789",
    });

    expect(mapped.email).toBe(
      "kakao-123456789@oauth.viet-tai-han.invalid"
    );
    expect(mapped.contactEmail).toBeUndefined();
    expect(mapped.emailVerified).toBe(false);
    expect(isSyntheticOAuthEmail(mapped.email)).toBe(true);
  });

  it("allows Zalo accounts without email", () => {
    const mapped = mapOAuthEmail({
      providerId: "zalo",
      accountId: "zalo-user-1",
      email: null,
    });

    expect(mapped.email).toBe(
      "zalo-zalo-user-1@oauth.viet-tai-han.invalid"
    );
    expect(mapped.contactEmail).toBeUndefined();
    expect(mapped.emailVerified).toBe(false);
  });

  it("stores a real Facebook email as optional contact data", () => {
    const mapped = mapOAuthEmail({
      providerId: "facebook",
      accountId: "facebook-user-1",
      email: "  Person@Example.com ",
      emailVerified: true,
    });

    expect(mapped).toEqual({
      email: "person@example.com",
      contactEmail: "person@example.com",
      emailVerified: true,
    });
    expect(isSyntheticOAuthEmail(mapped.email)).toBe(false);
  });

  it("keeps the provider account pair as a stable identity", () => {
    const first = createSyntheticOAuthEmail("kakao", "same-account");
    const second = createSyntheticOAuthEmail("kakao", "same-account");
    const otherProvider = createSyntheticOAuthEmail("zalo", "same-account");

    expect(first).toBe(second);
    expect(otherProvider).not.toBe(first);
  });

  it("never exposes Better Auth compatibility fields publicly", () => {
    const safeUser = stripOAuthCompatibilityFields({
      id: "user-1",
      email: createSyntheticOAuthEmail("zalo", "account-1"),
      onboardingUsernameCandidate: "provider_candidate",
      usernameChangedAt: "2026-01-01 00:00:00",
      name: "Zalo User",
    });

    expect(safeUser).toEqual({
      id: "user-1",
      name: "Zalo User",
    });
    expect("email" in safeUser).toBe(false);
    expect("onboardingUsernameCandidate" in safeUser).toBe(false);
    expect("usernameChangedAt" in safeUser).toBe(false);
  });

  it("stores provider profile names as onboarding username candidates", () => {
    expect(
      mapOAuthProfile({
        providerId: "facebook",
        accountId: "provider-1",
        name: "Nguyễn User",
        providerUsername: "Provider_Handle",
      })
    ).toEqual({
      name: "Nguyễn User",
      onboardingUsernameCandidate: "provider_handle",
    });
  });

  it("falls back when a provider omits the profile name", () => {
    const mapped = mapOAuthProfile({
      providerId: "zalo",
      accountId: "provider-2",
    });

    expect(mapped.name).toBe("VTH User");
    expect(mapped.onboardingUsernameCandidate).toMatch(
      /^vth_[a-f0-9]{12}$/
    );
  });
});
