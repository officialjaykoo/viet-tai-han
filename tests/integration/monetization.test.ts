import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import {
  recordAdClick,
  recordAdImpression,
  pickAdForPlacement,
  updateAdCampaign,
} from "@/lib/ads";
import {
  appendReputationLedgerEntry,
  getMonetizationContext,
  getProStatus,
  getUserConsent,
  parseBillingEvent,
  processBillingEvent,
  saveUserConsent,
} from "@/lib/monetization";
import { setSiteSetting } from "@/lib/settings";

describe("monetization persistence and gates", () => {
  it("persists consent, Pro entitlements, ledgers, and ad safeguards", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const userId = `monetization_user_${suffix}`;
    const campaignId = `monetization_campaign_${suffix}`;
    const now = new Date();
    const future = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const past = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    await env.DB.prepare(
      `INSERT INTO "user" (id, name, email, emailVerified, username, karma, role, status)
       VALUES (?, 'Monetization tester', ?, 1, ?, 10, 'user', 'active')`
    )
      .bind(userId, `${userId}@test.local`, userId)
      .run();
    await env.DB.prepare(
      `INSERT INTO ad_campaigns (
         id, name, status, placement, target_url, weight, created_by
       ) VALUES (?, 'Test campaign', 'active', 'feed_inline', 'https://example.com', 1, ?)`
    )
      .bind(campaignId, userId)
      .run();

    await setSiteSetting("ads_enabled", "1", userId);
    try {
      await expect(
        updateAdCampaign({
          id: campaignId,
          targetUrl: "javascript:alert(1)",
        })
      ).rejects.toThrow("Invalid target URL");
      const savedConsent = await saveUserConsent({
        userId,
        analytics: true,
        personalizedAds: true,
        marketing: false,
      });
      expect(savedConsent.analytics).toBe(true);
      expect(await getUserConsent(userId)).toMatchObject({
        userId,
        analytics: true,
        personalizedAds: true,
        marketing: false,
      });

      expect(await pickAdForPlacement("feed_inline")).toMatchObject({
        id: campaignId,
      });
      expect(
        await recordAdImpression({
          campaignId,
          viewerId: userId,
          placement: "feed_inline",
        })
      ).toBe(true);
      expect(
        await recordAdImpression({
          campaignId,
          viewerId: userId,
          placement: "feed_inline",
        })
      ).toBe(false);
      const impressionCount = await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM ad_impressions WHERE campaign_id = ? AND viewer_id = ?`
      )
        .bind(campaignId, userId)
        .first<{ count: number }>();
      expect(Number(impressionCount?.count ?? 0)).toBe(1);
      expect(await recordAdClick({ campaignId, viewerId: userId })).toBe(
        "https://example.com"
      );

      const subscriptionId = `sub_${suffix}`;
      const createdEvent = parseBillingEvent({
        provider: "test-provider",
        eventId: `evt_created_${suffix}`,
        type: "subscription.created",
        userId,
        customerId: `cus_${suffix}`,
        subscriptionId,
        plan: "monthly",
        status: "active",
        periodStart: now.toISOString(),
        periodEnd: future,
      });
      const firstProcess = await processBillingEvent({
        event: createdEvent,
        payloadHash: "a".repeat(64),
      });
      expect(firstProcess).toMatchObject({
        duplicate: false,
        userId,
        subscriptionId,
      });
      expect(
        await processBillingEvent({
          event: createdEvent,
          payloadHash: "a".repeat(64),
        })
      ).toMatchObject({ duplicate: true, userId, subscriptionId });
      expect(await getProStatus(userId)).toMatchObject({
        active: true,
        plan: "monthly",
        status: "active",
      });
      expect((await getMonetizationContext(userId)).isPro).toBe(true);
      expect(
        await recordAdImpression({
          campaignId,
          viewerId: userId,
          placement: "feed_inline",
        })
      ).toBe(false);

      const paymentEvent = parseBillingEvent({
        provider: "test-provider",
        eventId: `evt_payment_${suffix}`,
        type: "invoice.paid",
        userId,
        subscriptionId,
        transactionId: `txn_${suffix}`,
        amountMinor: 9900,
        currency: "krw",
      });
      await processBillingEvent({
        event: paymentEvent,
        payloadHash: "b".repeat(64),
      });
      await processBillingEvent({
        event: paymentEvent,
        payloadHash: "b".repeat(64),
      });
      const transactionCount = await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM transaction_ledger
         WHERE provider = 'test-provider' AND provider_transaction_id = ?`
      )
        .bind(`txn_${suffix}`)
        .first<{ count: number }>();
      expect(Number(transactionCount?.count ?? 0)).toBe(1);

      const reputationKey = `test:reputation:${suffix}`;
      expect(
        await appendReputationLedgerEntry({
          userId,
          eventType: "test_adjustment",
          amount: 3,
          kind: "general",
          idempotencyKey: reputationKey,
        })
      ).toMatchObject({ applied: true });
      expect(
        await appendReputationLedgerEntry({
          userId,
          eventType: "test_adjustment",
          amount: 3,
          kind: "general",
          idempotencyKey: reputationKey,
        })
      ).toMatchObject({ applied: false });
      const user = await env.DB.prepare(
        `SELECT karma FROM "user" WHERE id = ?`
      )
        .bind(userId)
        .first<{ karma: number }>();
      expect(user?.karma).toBe(13);

      const expiredEvent = parseBillingEvent({
        provider: "test-provider",
        eventId: `evt_expired_${suffix}`,
        type: "subscription.updated",
        userId,
        subscriptionId,
        plan: "monthly",
        status: "active",
        periodEnd: past,
      });

      await processBillingEvent({
        event: expiredEvent,
        payloadHash: "c".repeat(64),
      });
      expect((await getProStatus(userId)).active).toBe(false);
      await updateAdCampaign({ id: campaignId, status: "active" });
      await env.DB.prepare(
        `UPDATE ad_campaigns SET ends_at = ? WHERE id = ?`
      )
        .bind(past, campaignId)
        .run();
      expect(
        await recordAdImpression({
          campaignId,
          viewerId: userId,
          placement: "feed_inline",
        })
      ).toBe(false);
      await env.DB.prepare(
        `UPDATE ad_campaigns SET ends_at = NULL WHERE id = ?`
      )
        .bind(campaignId)
        .run();

      await env.DB.prepare(
        `UPDATE ad_campaigns SET status = 'paused' WHERE id = ?`
      )
        .bind(campaignId)
        .run();
      expect(await recordAdClick({ campaignId, viewerId: userId })).toBeNull();
      await setSiteSetting("ads_enabled", "0", userId);
      expect(await pickAdForPlacement("feed_inline")).toBeNull();
    } finally {
      await setSiteSetting("ads_enabled", "0", userId);
    }

    const tables = await env.DB.prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name IN (
         'user_consents', 'pro_subscriptions', 'billing_events',
         'transaction_ledger', 'reputation_ledger'
       )
       ORDER BY name`
    ).all<{ name: string }>();
    expect(tables.results?.map((row) => row.name)).toEqual([
      "billing_events",
      "pro_subscriptions",
      "reputation_ledger",
      "transaction_ledger",
      "user_consents",
    ]);
  });
});
