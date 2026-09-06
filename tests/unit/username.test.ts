import { describe, expect, it } from "vitest";

import {
  createUsernameCandidate,
  isUsernameChangeAllowed,
  normalizeUsername,
  usernameCooldownEndsAt,
  usernameReservedUntil,
  validateUsername,
} from "@/lib/username";

describe("username policy", () => {
  it("normalizes and validates the public handle policy", () => {
    expect(normalizeUsername("  @Jay_Koo  ")).toBe("jay_koo");
    expect(validateUsername("Jay_Koo")).toEqual({
      ok: true,
      username: "jay_koo",
    });
    expect(validateUsername("ab").ok).toBe(false);
    expect(validateUsername("bad-name").ok).toBe(false);
    expect(validateUsername("a".repeat(25)).ok).toBe(false);
  });

  it("prefers provider handles and falls back to display names", () => {
    expect(
      createUsernameCandidate({
        providerUsername: "Provider_Name",
        displayName: "Display Name",
      })
    ).toBe("provider_name");
    expect(createUsernameCandidate({ displayName: "Nguyễn User" })).toBe(
      "nguyen_user"
    );
  });

  it("enforces the cooldown and reuse hold dates", () => {
    const changedAt = new Date("2025-01-01T00:00:00.000Z");
    const cooldownEnds = usernameCooldownEndsAt(
      "2025-01-01 00:00:00"
    );
    expect(cooldownEnds?.toISOString()).toBe("2025-04-01T00:00:00.000Z");
    expect(isUsernameChangeAllowed("2025-01-01 00:00:00", changedAt)).toBe(
      false
    );
    expect(
      isUsernameChangeAllowed(
        "2025-01-01 00:00:00",
        new Date("2025-04-01T00:00:00.000Z")
      )
    ).toBe(true);
    expect(usernameReservedUntil(changedAt)).toBe("2025-06-30 00:00:00");
  });
});
