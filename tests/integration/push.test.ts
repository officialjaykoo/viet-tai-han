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
  it("saves, refreshes, and deletes a browser subscription", async () => {
    const userId = `push_user_${crypto.randomUUID()}`;
    const otherUserId = `push_other_${crypto.randomUUID()}`;
    await insertPushUser(userId);
    await insertPushUser(otherUserId);

    const subscription = validatePushSubscription({
      endpoint: "https://push.example.test/subscription",
      keys: {
        p256dh: bytesToBase64Url(
          Uint8Array.from({ length: 65 }, (_, index) => (index === 0 ? 4 : index))
        ),
        auth: bytesToBase64Url(
          Uint8Array.from({ length: 16 }, (_, index) => index + 1)
        ),
      },
      userAgent: "test-browser",
    });

    await expect(savePushSubscription(userId, subscription)).resolves.toEqual({
      ok: true,
    });
    await expect(getPushStatus(userId)).resolves.toMatchObject({
      subscribed: true,
    });

    await expect(
      savePushSubscription(otherUserId, {
        ...subscription,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      })
    ).resolves.toEqual({ ok: true });
    await expect(getPushStatus(userId)).resolves.toMatchObject({
      subscribed: false,
    });
    await expect(getPushStatus(otherUserId)).resolves.toMatchObject({
      subscribed: true,
    });

    await expect(
      deletePushSubscription(userId, subscription.endpoint)
    ).resolves.toMatchObject({ deleted: false });
    await expect(
      deletePushSubscription(otherUserId, subscription.endpoint)
    ).resolves.toMatchObject({ deleted: true });
    await expect(getPushStatus(otherUserId)).resolves.toMatchObject({
      subscribed: false,
    });
  });
});
