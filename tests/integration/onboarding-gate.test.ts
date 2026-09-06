import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { isOnboardingComplete } from "@/lib/onboarding-access";

async function insertGateUser(userId: string, onboardingComplete: 0 | 1) {
  const username = `gate_${crypto.randomUUID().slice(0, 10)}`;
  await env.DB.prepare(
    `INSERT INTO "user" (
       id, name, email, emailVerified, username,
       onboardingComplete, role, status, preferredLanguage
     ) VALUES (?, 'Gate User', ?, 0, ?, ?, 'user', 'active', 'en')`
  )
    .bind(userId, `${userId}@oauth.test`, username, onboardingComplete)
    .run();
}

describe("onboarding access gate", () => {
  it("blocks incomplete users before normal page work", async () => {
    const userId = `gate_incomplete_${crypto.randomUUID()}`;
    await insertGateUser(userId, 0);

    await expect(isOnboardingComplete(userId)).resolves.toBe(false);
  });

  it("allows completed users to continue", async () => {
    const userId = `gate_complete_${crypto.randomUUID()}`;
    await insertGateUser(userId, 1);

    await expect(isOnboardingComplete(userId)).resolves.toBe(true);
  });
});
