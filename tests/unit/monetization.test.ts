import { describe, expect, it } from "vitest";

import {
  createBillingSignature,
  decodeHex,
  isProSubscriptionActive,
  parseBillingEvent,
  verifyBillingSignature,
} from "@/lib/monetization";

describe("monetization contracts", () => {
  it("accepts a normalized subscription event", () => {
    const event = parseBillingEvent({
      provider: "test-provider",
      eventId: "evt_123",
      type: "subscription.created",
      userId: "user_123",
      customerId: "cus_123",
      subscriptionId: "sub_123",
      plan: "annual",
      status: "active",
      periodStart: "2026-09-01T00:00:00.000Z",
      periodEnd: "2027-09-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    });

    expect(event).toMatchObject({
      provider: "test-provider",
      eventId: "evt_123",
      type: "subscription.created",
      plan: "annual",
      status: "active",
      cancelAtPeriodEnd: false,
    });
  });

  it("rejects unsupported or incomplete billing events", () => {
    expect(() =>
      parseBillingEvent({
        provider: "test-provider",
        eventId: "evt_bad",
        type: "unknown.event",
      })
    ).toThrow("Unsupported billing event");
    expect(() =>
      parseBillingEvent({
        provider: "test-provider",
        eventId: "evt_bad",
        type: "invoice.paid",
        userId: "user_123",
      })
    ).toThrow("Billing transaction fields are required");
  });

  it("keeps Pro active only through a valid entitlement period", () => {
    const now = Date.parse("2026-09-04T00:00:00.000Z");
    expect(
      isProSubscriptionActive(
        {
          plan: "monthly",
          status: "active",
          currentPeriodEnd: "2026-09-05T00:00:00.000Z",
        },
        now
      )
    ).toBe(true);
    expect(
      isProSubscriptionActive(
        {
          plan: "monthly",
          status: "canceled",
          currentPeriodEnd: "2026-09-05T00:00:00.000Z",
        },
        now
      )
    ).toBe(true);
    expect(
      isProSubscriptionActive(
        {
          plan: "monthly",
          status: "active",
          currentPeriodEnd: "2026-09-03T00:00:00.000Z",
        },
        now
      )
    ).toBe(false);
    expect(
      isProSubscriptionActive(
        { plan: "lifetime", status: "active", currentPeriodEnd: null },
        now
      )
    ).toBe(true);
    expect(
      isProSubscriptionActive(
        { plan: "monthly", status: "past_due", currentPeriodEnd: null },
        now
      )
    ).toBe(false);
  });

  it("verifies the raw-body HMAC signature in constant-time form", async () => {
    const secret = "test-billing-secret";
    const body = '{"eventId":"evt_123"}';
    const signature = await createBillingSignature(secret, body);

    expect(await verifyBillingSignature({ secret, body, signature })).toBe(true);
    expect(
      await verifyBillingSignature({
        secret,
        body,
        signature: signature.toUpperCase(),
      })
    ).toBe(true);
    expect(
      await verifyBillingSignature({
        secret,
        body,
        signature: `${signature.slice(0, -2)}00`,
      })
    ).toBe(false);
    expect(decodeHex("zz")).toBeNull();
  });
});
