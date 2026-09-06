import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { CacheKeys, cacheDelete } from "@/lib/cache";
import { invalidateBannedWordsCache } from "@/lib/moderation";
import { startChatRequest } from "@/lib/messages";
import { requireCanMessage } from "@/lib/permissions";
import { setSiteSetting } from "@/lib/settings";

async function insertUser(id: string, username: string, karma = 0) {
  await env.DB
    .prepare(
      `INSERT INTO "user" (id, name, email, emailVerified, username, karma, role, status)
       VALUES (?, ?, ?, 1, ?, ?, 'user', 'active')`
    )
    .bind(id, username, `${id}@test.local`, username, karma)
    .run();
}

describe("DM karma policy (D1)", () => {
  it("allows a karma-zero user when the setting is absent", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const senderId = `dm_sender_${suffix}`;
    const recipientId = `dm_recipient_${suffix}`;
    const senderUsername = `dm_sender_${suffix}`;
    const recipientUsername = `dm_recipient_${suffix}`;
    await Promise.all([
      insertUser(senderId, senderUsername),
      insertUser(recipientId, recipientUsername),
    ]);

    await env.DB
      .prepare(`DELETE FROM site_settings WHERE key = 'min_karma_to_dm'`)
      .run();
    await cacheDelete(CacheKeys.siteSetting("min_karma_to_dm"));

    await expect(
      requireCanMessage({ id: senderId, status: "active", karma: 0 })
    ).resolves.toMatchObject({ id: senderId });

    const request = await startChatRequest({
      fromUserId: senderId,
      toUsername: recipientUsername,
      openerBody: "Hello from a new account.",
      fromStatus: "active",
    });
    expect(request.toUsername).toBe(recipientUsername);
  });

  it("keeps block, privacy, and moderation guards after lowering the karma gate", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const senderId = `dm_guard_sender_${suffix}`;
    const blockedId = `dm_guard_blocked_${suffix}`;
    const privateId = `dm_guard_private_${suffix}`;
    const moderatedId = `dm_guard_moderated_${suffix}`;
    const blockedUsername = `dm_guard_blocked_${suffix}`;
    const privateUsername = `dm_guard_private_${suffix}`;
    const moderatedUsername = `dm_guard_moderated_${suffix}`;
    const bannedWord = `dmblock${suffix}`;
    await Promise.all([
      insertUser(senderId, `dm_guard_sender_${suffix}`),
      insertUser(blockedId, blockedUsername),
      insertUser(privateId, privateUsername),
      insertUser(moderatedId, moderatedUsername),
    ]);
    await setSiteSetting("min_karma_to_dm", "0");

    await env.DB
      .prepare(
        `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)`
      )
      .bind(senderId, blockedId)
      .run();
    await expect(
      startChatRequest({
        fromUserId: senderId,
        toUsername: blockedUsername,
        openerBody: "Blocked recipient",
      })
    ).rejects.toMatchObject({
      status: 403,
      message: "You can't message this user",
    });

    await env.DB
      .prepare(`UPDATE "user" SET allowDms = 'nobody' WHERE id = ?`)
      .bind(privateId)
      .run();
    await expect(
      startChatRequest({
        fromUserId: senderId,
        toUsername: privateUsername,
        openerBody: "Private recipient",
      })
    ).rejects.toMatchObject({
      status: 403,
      message: "This user isn't accepting chat requests",
    });

    await env.DB
      .prepare(
        `INSERT INTO banned_words (id, word, severity) VALUES (?, ?, 'block')`
      )
      .bind(crypto.randomUUID(), bannedWord)
      .run();
    await invalidateBannedWordsCache();
    await expect(
      startChatRequest({
        fromUserId: senderId,
        toUsername: moderatedUsername,
        openerBody: `Contains ${bannedWord}`,
      })
    ).rejects.toMatchObject({
      status: 400,
      message: "This content isn't allowed",
    });
  });

  it("retains the hourly request limit for karma-zero users", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const senderId = `dm_rate_sender_${suffix}`;
    const firstRecipientId = `dm_rate_first_${suffix}`;
    const secondRecipientId = `dm_rate_second_${suffix}`;
    await Promise.all([
      insertUser(senderId, `dm_rate_sender_${suffix}`),
      insertUser(firstRecipientId, `dm_rate_first_${suffix}`),
      insertUser(secondRecipientId, `dm_rate_second_${suffix}`),
    ]);
    await setSiteSetting("min_karma_to_dm", "0");
    await setSiteSetting("max_dm_requests_per_hour", "1");
    await setSiteSetting("max_dm_requests_burst_per_min", "10");

    const hourlySetting = await env.DB
      .prepare(
        `SELECT value FROM site_settings WHERE key = 'max_dm_requests_per_hour'`
      )
      .first<{ value: string }>();
    expect(hourlySetting?.value).toBe("1");

    await startChatRequest({
      fromUserId: senderId,
      toUsername: `dm_rate_first_${suffix}`,
      openerBody: "First request",
    });
    const hourlyEvents = await env.DB
      .prepare(
        `SELECT COUNT(*) AS count FROM security_rate_events
         WHERE subject = ? AND action = 'dm_request'`
      )
      .bind(`user:${senderId}`)
      .first<{ count: number }>();
    expect(Number(hourlyEvents?.count)).toBe(1);
    await expect(
      startChatRequest({
        fromUserId: senderId,
        toUsername: `dm_rate_second_${suffix}`,
        openerBody: "Second request",
      })
    ).rejects.toMatchObject({
      status: 429,
      message: "You're doing that too often. Try again later.",
    });
  });
});
