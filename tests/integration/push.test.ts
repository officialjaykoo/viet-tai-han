import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import {
  deletePushSubscription,
  getPushStatus,
  savePushSubscription,
  validatePushSubscription,
} from "@/lib/push";
import { bytesToBase64Url } from "@/lib/security/crypto";

async function insertPushUser(userId: string) {
  await env.DB.prepare(
    `INSERT INTO "user" (id, name, email, emailVerified, username, role, status)
     VALUES (?, 'Push User', ?, 1, ?, 'user', 'active')`
  )
    .bind(userId, `${userId}@push.test`, `push_${userId.slice(-8)}`)
    .run();
}

describe("push subscriptions (D1)", () => {
  it("tracks subscriptions per device and only disables the current device", async () => {
    const userId = `push_user_${crypto.randomUUID()}`;
    const otherUserId = `push_other_${crypto.randomUUID()}`;
    await insertPushUser(userId);
    await insertPushUser(otherUserId);

    const keys = {
      p256dh: bytesToBase64Url(
        Uint8Array.from({ length: 65 }, (_, index) => (index === 0 ? 4 : index))
      ),
      auth: bytesToBase64Url(
        Uint8Array.from({ length: 16 }, (_, index) => index + 1)
      ),
    };
    const subscriptionA = validatePushSubscription({
      endpoint: "https://push.example.test/subscription-a",
      keys,
      userAgent: "test-browser-a",
    });
    const subscriptionB = validatePushSubscription({
      endpoint: "https://push.example.test/subscription-b",
      keys,
      userAgent: "test-browser-b",
    });
    const subscriptionOther = validatePushSubscription({
      endpoint: "https://push.example.test/subscription-other",
      keys,
      userAgent: "test-browser-other",
    });

    await expect(savePushSubscription(userId, subscriptionA)).resolves.toEqual({
      ok: true,
    });
    await expect(savePushSubscription(userId, subscriptionB)).resolves.toEqual({
      ok: true,
    });
    await expect(getPushStatus(userId, subscriptionA.endpoint)).resolves.toMatchObject({
      currentDeviceSubscribed: true,
      activeDeviceCount: 2,
      hasAnySubscription: true,
    });
    await expect(getPushStatus(otherUserId)).resolves.toMatchObject({
      currentDeviceSubscribed: false,
      activeDeviceCount: 0,
      hasAnySubscription: false,
    });

    await expect(
      savePushSubscription(otherUserId, subscriptionOther)
    ).resolves.toEqual({ ok: true });
    await expect(
      getPushStatus(otherUserId, subscriptionOther.endpoint)
    ).resolves.toMatchObject({
      currentDeviceSubscribed: true,
      activeDeviceCount: 1,
      hasAnySubscription: true,
    });

    await expect(
      deletePushSubscription(otherUserId, subscriptionOther.endpoint)
    ).resolves.toMatchObject({ deleted: true });
    await expect(
      getPushStatus(otherUserId, subscriptionOther.endpoint)
    ).resolves.toMatchObject({
      currentDeviceSubscribed: false,
      activeDeviceCount: 0,
      hasAnySubscription: false,
    });
    await expect(
      getPushStatus(userId, subscriptionA.endpoint)
    ).resolves.toMatchObject({
      currentDeviceSubscribed: true,
      activeDeviceCount: 2,
      hasAnySubscription: true,
    });
  });
});
