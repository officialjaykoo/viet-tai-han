import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import {
  completeOnboarding,
  getOnboardingState,
} from "@/lib/onboarding";
import {
  getUserSettings,
  updateUserContactEmail,
} from "@/lib/user-settings";

async function insertUser(userId: string, username: string) {
  await env.DB.prepare(
    `INSERT INTO "user" (
       id, name, email, emailVerified, username,
       role, status, preferredLanguage
     ) VALUES (?, 'Temporary user', ?, 0, ?, 'user', 'active', 'unknown')`
  )
    .bind(userId, `${userId}@oauth.test`, username)
    .run();
}

describe("social-first onboarding", () => {
  it("persists the profile fields and completion transition", async () => {
    const userId = `onboarding_${crypto.randomUUID()}`;
    await insertUser(userId, `tmp_${crypto.randomUUID().slice(0, 8)}`);

    expect(await getOnboardingState(userId)).toMatchObject({
      id: userId,
      onboardingComplete: false,
      preferredLanguage: "unknown",
    });

    const state = await completeOnboarding({
      userId,
      name: "  Nguyễn User  ",
      username: `new_${crypto.randomUUID().slice(0, 8)}`,
      preferredLanguage: "ko",
    });

    expect(state).toMatchObject({
      id: userId,
      name: "Nguyễn User",
      preferredLanguage: "ko",
      onboardingComplete: true,
    });
    expect(state.username).toMatch(/^new_[a-f0-9]{8}$/);

    const persisted = await env.DB.prepare(
      `SELECT name, username, preferredLanguage, onboardingComplete
       FROM "user" WHERE id = ?`
    )
      .bind(userId)
      .first<{
        name: string;
        username: string;
        preferredLanguage: string;
        onboardingComplete: number;
      }>();
    expect(persisted).toMatchObject({
      name: "Nguyễn User",
      preferredLanguage: "ko",
      onboardingComplete: 1,
    });
  });

  it("rejects invalid and duplicate onboarding usernames", async () => {
    const firstId = `onboarding_first_${crypto.randomUUID()}`;
    const secondId = `onboarding_second_${crypto.randomUUID()}`;
    await insertUser(firstId, `tmp_${crypto.randomUUID().slice(0, 8)}`);
    await insertUser(secondId, `tmp_${crypto.randomUUID().slice(0, 8)}`);

    await completeOnboarding({
      userId: firstId,
      name: "First User",
      username: "taken_name",
      preferredLanguage: "vi",
    });

    await expect(
      completeOnboarding({
        userId: secondId,
        name: "Second User",
        username: "taken_name",
        preferredLanguage: "vi",
      })
    ).rejects.toMatchObject({ status: 409 });

    await expect(
      completeOnboarding({
        userId: secondId,
        name: "Second User",
        username: "bad-name",
        preferredLanguage: "vi",
      })
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      completeOnboarding({
        userId: secondId,
        name: "Second User",
        username: "valid_name",
        preferredLanguage: "de",
      })
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      completeOnboarding({
        userId: secondId,
        name: "   ",
        username: "valid_name",
        preferredLanguage: "vi",
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("keeps contact email optional and separate from sign-in identity", async () => {
    const userId = `contact_${crypto.randomUUID()}`;
    await insertUser(userId, `tmp_${crypto.randomUUID().slice(0, 8)}`);

    expect((await getUserSettings(userId))?.contactEmail).toBeNull();

    await expect(
      updateUserContactEmail(userId, "not-an-email")
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      updateUserContactEmail(userId, "Person@Example.com")
    ).resolves.toEqual({
      contactEmail: "person@example.com",
      contactEmailVerified: false,
    });
    expect((await getUserSettings(userId))?.contactEmail).toBe(
      "person@example.com"
    );

    await expect(updateUserContactEmail(userId, "")).resolves.toEqual({
      contactEmail: null,
      contactEmailVerified: false,
    });
    expect((await getUserSettings(userId))?.contactEmail).toBeNull();
  });
});
