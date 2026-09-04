import { getDb } from "@/lib/db";
import { CONSENT_VERSION } from "@/lib/consent";
import { hmacSha256, timingSafeEqual } from "@/lib/security/crypto";
import { AuthError } from "@/lib/session";

export { CONSENT_VERSION };

export type ConsentRecord = {
  userId: string;
  consentVersion: string;
  analytics: boolean;
  personalizedAds: boolean;
  marketing: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProPlan = "monthly" | "annual" | "lifetime";
export type ProSubscriptionStatus =
  | "pending"
  | "active"
  | "past_due"
  | "canceled"
  | "expired";

export type ProStatus = {
  active: boolean;
  plan: ProPlan | null;
  status: ProSubscriptionStatus | null;
  provider: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type MonetizationContext = {
  isPro: boolean;
  analyticsAllowed: boolean;
  personalizedAdsAllowed: boolean;
};

export type BillingEventType =
  | "subscription.created"
  | "subscription.updated"
  | "subscription.canceled"
  | "invoice.paid"
  | "invoice.payment_failed"
  | "charge.refunded";

export type NormalizedBillingEvent = {
  provider: string;
  eventId: string;
  type: BillingEventType;
  userId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  plan: ProPlan | null;
  status: ProSubscriptionStatus | null;
  periodStart: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  transactionId: string | null;
  amountMinor: number | null;
  currency: string | null;
};

const BILLING_EVENT_TYPES = [
  "subscription.created",
  "subscription.updated",
  "subscription.canceled",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.refunded",
] as const satisfies readonly BillingEventType[];

const PRO_PLANS = ["monthly", "annual", "lifetime"] as const satisfies readonly ProPlan[];
const PRO_STATUSES = [
  "pending",
  "active",
  "past_due",
  "canceled",
  "expired",
] as const satisfies readonly ProSubscriptionStatus[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function requiredText(
  value: unknown,
  field: string,
  maxLength = 160
): string {
  if (typeof value !== "string") {
    throw new AuthError(`Invalid billing ${field}`, 400);
  }
  const text = value.trim();
  if (!text || text.length > maxLength) {
    throw new AuthError(`Invalid billing ${field}`, 400);
  }
  return text;
}

function optionalText(value: unknown, field: string, maxLength = 160): string | null {
  if (value == null) return null;
  return requiredText(value, field, maxLength);
}

function optionalDate(value: unknown, field: string): string | null {
  const text = optionalText(value, field, 64);
  if (text == null) return null;
  if (Number.isNaN(Date.parse(text))) {
    throw new AuthError(`Invalid billing ${field}`, 400);
  }
  return text;
}

function optionalPlan(value: unknown): ProPlan | null {
  if (value == null) return null;
  if (typeof value !== "string" || !PRO_PLANS.includes(value as ProPlan)) {
    throw new AuthError("Invalid billing plan", 400);
  }
  return value as ProPlan;
}

function optionalStatus(value: unknown): ProSubscriptionStatus | null {
  if (value == null) return null;
  if (
    typeof value !== "string" ||
    !PRO_STATUSES.includes(value as ProSubscriptionStatus)
  ) {
    throw new AuthError("Invalid billing status", 400);
  }
  return value as ProSubscriptionStatus;
}

function optionalAmount(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new AuthError("Invalid billing amount", 400);
  }
  return value;
}

function optionalCurrency(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || !/^[A-Za-z]{3}$/.test(value.trim())) {
    throw new AuthError("Invalid billing currency", 400);
  }
  return value.trim().toUpperCase();
}

/** Validate the provider-neutral event contract before it reaches D1. */
export function parseBillingEvent(value: unknown): NormalizedBillingEvent {
  if (!isRecord(value)) throw new AuthError("Invalid billing event", 400);

  const provider = requiredText(value.provider, "provider", 64);
  const eventId = requiredText(value.eventId, "event id", 200);
  const typeValue = requiredText(value.type, "event type", 64);
  if (!BILLING_EVENT_TYPES.includes(typeValue as BillingEventType)) {
    throw new AuthError("Unsupported billing event", 400);
  }

  const type = typeValue as BillingEventType;
  const userId = optionalText(value.userId, "user id", 128);
  const customerId = optionalText(value.customerId, "customer id", 200);
  const subscriptionId = optionalText(value.subscriptionId, "subscription id", 200);
  const plan = optionalPlan(value.plan);
  const status = optionalStatus(value.status);
  const periodStart = optionalDate(value.periodStart, "period start");
  const periodEnd = optionalDate(value.periodEnd, "period end");
  const cancelAtPeriodEnd = value.cancelAtPeriodEnd == null ? false : value.cancelAtPeriodEnd;
  if (typeof cancelAtPeriodEnd !== "boolean") {
    throw new AuthError("Invalid billing cancellation flag", 400);
  }
  const transactionId = optionalText(value.transactionId, "transaction id", 200);
  const amountMinor = optionalAmount(value.amountMinor);
  const currency = optionalCurrency(value.currency);

  if (type.startsWith("subscription.") && !subscriptionId) {
    throw new AuthError("Billing subscription id is required", 400);
  }
  if ((type === "subscription.created" || type === "subscription.updated") && (!userId || !plan)) {
    throw new AuthError("Billing user id and plan are required", 400);
  }
  if (type === "invoice.paid" || type === "invoice.payment_failed" || type === "charge.refunded") {
    if (!transactionId || amountMinor == null || !currency) {
      throw new AuthError("Billing transaction fields are required", 400);
    }
  }

  return {
    provider,
    eventId,
    type,
    userId,
    customerId,
    subscriptionId,
    plan,
    status: status ?? (type === "subscription.canceled" ? "canceled" : null),
    periodStart,
    periodEnd,
    cancelAtPeriodEnd,
    transactionId,
    amountMinor,
    currency,
  };
}

export async function createBillingSignature(
  secret: string,
  body: string
): Promise<string> {
  if (!secret.trim()) throw new Error("Billing webhook secret is missing");
  const signature = await hmacSha256(
    new TextEncoder().encode(secret.trim()),
    body
  );
  return [...signature].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function decodeHex(value: string): Uint8Array | null {
  if (!value || value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) {
    return null;
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export async function verifyBillingSignature(input: {
  secret: string;
  body: string;
  signature: string;
}): Promise<boolean> {
  const expected = decodeHex(
    await createBillingSignature(input.secret, input.body)
  );
  const provided = decodeHex(input.signature.trim());
  return (
    expected != null &&
    provided != null &&
    timingSafeEqual(expected, provided)
  );
}

export async function getUserConsent(userId: string): Promise<ConsentRecord | null> {
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT user_id, consent_version, analytics, personalized_ads, marketing,
              created_at, updated_at
       FROM user_consents
       WHERE user_id = ?`
    )
    .bind(userId)
    .first<{
      user_id: string;
      consent_version: string;
      analytics: number;
      personalized_ads: number;
      marketing: number;
      created_at: string;
      updated_at: string;
    }>();
  if (!row) return null;
  return {
    userId: row.user_id,
    consentVersion: row.consent_version,
    analytics: Boolean(row.analytics),
    personalizedAds: Boolean(row.personalized_ads),
    marketing: Boolean(row.marketing),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function saveUserConsent(input: {
  userId: string;
  consentVersion?: string;
  analytics: boolean;
  personalizedAds: boolean;
  marketing: boolean;
}): Promise<ConsentRecord> {
  if (
    typeof input.analytics !== "boolean" ||
    typeof input.personalizedAds !== "boolean" ||
    typeof input.marketing !== "boolean"
  ) {
    throw new AuthError("Invalid consent choices", 400);
  }
  const consentVersion = input.consentVersion ?? CONSENT_VERSION;
  if (consentVersion !== CONSENT_VERSION) {
    throw new AuthError("Consent version is outdated", 400);
  }

  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO user_consents (
         user_id, consent_version, analytics, personalized_ads, marketing
       ) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         consent_version = excluded.consent_version,
         analytics = excluded.analytics,
         personalized_ads = excluded.personalized_ads,
         marketing = excluded.marketing,
         updated_at = datetime('now')`
    )
    .bind(
      input.userId,
      consentVersion,
      input.analytics ? 1 : 0,
      input.personalizedAds ? 1 : 0,
      input.marketing ? 1 : 0
    )
    .run();

  const saved = await getUserConsent(input.userId);
  if (!saved) throw new Error("Consent was not saved");
  return saved;
}

export function isProSubscriptionActive(
  subscription: {
    plan: ProPlan;
    status: ProSubscriptionStatus;
    currentPeriodEnd: string | null;
  },
  now = Date.now()
): boolean {
  if (subscription.status === "active" && subscription.plan === "lifetime") {
    return true;
  }
  if (subscription.status !== "active" && subscription.status !== "canceled") {
    return false;
  }
  if (!subscription.currentPeriodEnd) {
    return subscription.status === "active";
  }
  const periodEnd = Date.parse(subscription.currentPeriodEnd);
  return !Number.isNaN(periodEnd) && periodEnd > now;
}

export async function getProStatus(userId: string): Promise<ProStatus> {
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT provider, plan, status, current_period_end, cancel_at_period_end
       FROM pro_subscriptions
       WHERE user_id = ?
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`
    )
    .bind(userId)
    .first<{
      provider: string;
      plan: ProPlan;
      status: ProSubscriptionStatus;
      current_period_end: string | null;
      cancel_at_period_end: number;
    }>();
  if (!row) {
    return {
      active: false,
      plan: null,
      status: null,
      provider: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }
  return {
    active: isProSubscriptionActive({
      plan: row.plan,
      status: row.status,
      currentPeriodEnd: row.current_period_end,
    }),
    plan: row.plan,
    status: row.status,
    provider: row.provider,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
  };
}

export async function getMonetizationContext(
  userId: string | null | undefined
): Promise<MonetizationContext> {
  if (!userId) {
    return {
      isPro: false,
      analyticsAllowed: false,
      personalizedAdsAllowed: false,
    };
  }
  const [pro, consent] = await Promise.all([
    getProStatus(userId),
    getUserConsent(userId),
  ]);
  return {
    isPro: pro.active,
    analyticsAllowed: consent?.analytics === true,
    personalizedAdsAllowed: consent?.personalizedAds === true,
  };
}

export type ReputationLedgerKind = "general" | "post" | "comment";

export async function appendReputationLedgerEntry(input: {
  userId: string;
  eventType: string;
  amount: number;
  kind?: ReputationLedgerKind;
  sourceType?: string | null;
  sourceId?: string | null;
  idempotencyKey?: string;
  metadata?: Record<string, unknown> | null;
}): Promise<{ id: string; applied: boolean }> {
  if (!input.userId || !input.eventType.trim()) {
    throw new AuthError("Invalid reputation ledger entry", 400);
  }
  if (!Number.isSafeInteger(input.amount) || input.amount === 0) {
    throw new AuthError("Invalid reputation amount", 400);
  }
  const idempotencyKey = input.idempotencyKey?.trim() || crypto.randomUUID();
  const id = crypto.randomUUID();
  const db = await getDb();
  const inserted = await db
    .prepare(
      `INSERT OR IGNORE INTO reputation_ledger (
         id, user_id, event_type, amount, source_type, source_id,
         idempotency_key, metadata_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.userId,
      input.eventType.trim().slice(0, 80),
      input.amount,
      input.sourceType?.trim().slice(0, 80) ?? null,
      input.sourceId?.trim().slice(0, 200) ?? null,
      idempotencyKey,
      input.metadata ? JSON.stringify(input.metadata) : null
    )
    .run();
  if (Number(inserted.meta?.changes ?? 0) === 0) {
    const existing = await db
      .prepare(`SELECT id FROM reputation_ledger WHERE idempotency_key = ?`)
      .bind(idempotencyKey)
      .first<{ id: string }>();
    if (!existing) throw new Error("Reputation ledger conflict");
    return { id: existing.id, applied: false };
  }

  const kind = input.kind ?? "general";
  const update =
    kind === "post"
      ? `UPDATE "user"
         SET postKarma = postKarma + ?, karma = karma + ?, updatedAt = datetime('now')
         WHERE id = ?`
      : kind === "comment"
        ? `UPDATE "user"
           SET commentKarma = commentKarma + ?, karma = karma + ?, updatedAt = datetime('now')
           WHERE id = ?`
        : `UPDATE "user"
           SET karma = karma + ?, updatedAt = datetime('now')
           WHERE id = ?`;
  if (kind === "general") {
    await db.prepare(update).bind(input.amount, input.userId).run();
  } else {
    await db.prepare(update).bind(input.amount, input.amount, input.userId).run();
  }
  return { id, applied: true };
}

export async function getReputationBalance(userId: string) {
  const db = await getDb();
  return await db
    .prepare(
      `SELECT karma, postKarma AS post_karma, commentKarma AS comment_karma
       FROM "user" WHERE id = ?`
    )
    .bind(userId)
    .first<{ karma: number; post_karma: number; comment_karma: number }>();
}

type SubscriptionRow = {
  id: string;
  user_id: string;
  provider: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  plan: ProPlan;
  status: ProSubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: number;
};

async function resolveBillingUser(
  event: NormalizedBillingEvent,
  existingSubscription: SubscriptionRow | null
): Promise<string> {
  const db = await getDb();
  let userId = event.userId ?? existingSubscription?.user_id ?? null;
  if (!userId && event.customerId) {
    const row = await db
      .prepare(
        `SELECT user_id FROM pro_subscriptions
         WHERE provider = ? AND provider_customer_id = ?
         ORDER BY updated_at DESC LIMIT 1`
      )
      .bind(event.provider, event.customerId)
      .first<{ user_id: string }>();
    userId = row?.user_id ?? null;
  }
  if (!userId) throw new Error("Billing event is not linked to a user");
  const user = await db
    .prepare(`SELECT id FROM "user" WHERE id = ?`)
    .bind(userId)
    .first<{ id: string }>();
  if (!user) throw new Error("Billing user not found");
  return userId;
}

async function applySubscriptionEvent(event: NormalizedBillingEvent): Promise<{
  userId: string;
  subscriptionId: string;
}> {
  const db = await getDb();
  const subscriptionId = event.subscriptionId!;
  const existing = await db
    .prepare(
      `SELECT id, user_id, provider, provider_customer_id, provider_subscription_id,
              plan, status, current_period_start, current_period_end, cancel_at_period_end
       FROM pro_subscriptions
       WHERE provider = ? AND provider_subscription_id = ?`
    )
    .bind(event.provider, subscriptionId)
    .first<SubscriptionRow>();
  if (event.type === "subscription.canceled" && !existing) {
    throw new Error("Billing subscription not found");
  }
  const userId = await resolveBillingUser(event, existing ?? null);
  const plan = event.plan ?? existing?.plan;
  if (!plan) throw new Error("Billing subscription plan is missing");
  const status = event.status ?? (event.type === "subscription.canceled" ? "canceled" : "active");
  const id = existing?.id ?? crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO pro_subscriptions (
         id, user_id, provider, provider_customer_id, provider_subscription_id,
         plan, status, current_period_start, current_period_end, cancel_at_period_end
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, provider_subscription_id) DO UPDATE SET
         user_id = excluded.user_id,
         provider_customer_id = COALESCE(excluded.provider_customer_id, pro_subscriptions.provider_customer_id),
         plan = excluded.plan,
         status = excluded.status,
         current_period_start = COALESCE(excluded.current_period_start, pro_subscriptions.current_period_start),
         current_period_end = COALESCE(excluded.current_period_end, pro_subscriptions.current_period_end),
         cancel_at_period_end = excluded.cancel_at_period_end,
         updated_at = datetime('now')`
    )
    .bind(
      id,
      userId,
      event.provider,
      event.customerId,
      subscriptionId,
      plan,
      status,
      event.periodStart ?? existing?.current_period_start ?? null,
      event.periodEnd ?? existing?.current_period_end ?? null,
      event.cancelAtPeriodEnd ? 1 : 0
    )
    .run();
  return { userId, subscriptionId };
}

async function applyTransactionEvent(event: NormalizedBillingEvent): Promise<{
  userId: string;
  subscriptionId: string | null;
}> {
  const db = await getDb();
  let existingSubscription: SubscriptionRow | null = null;
  if (event.subscriptionId) {
    existingSubscription = await db
      .prepare(
        `SELECT id, user_id, provider, provider_customer_id, provider_subscription_id,
                plan, status, current_period_start, current_period_end, cancel_at_period_end
         FROM pro_subscriptions
         WHERE provider = ? AND provider_subscription_id = ?`
      )
      .bind(event.provider, event.subscriptionId)
      .first<SubscriptionRow>();
  }
  const userId = await resolveBillingUser(event, existingSubscription);
  const isRefund = event.type === "charge.refunded";
  const isFailed = event.type === "invoice.payment_failed";
  const kind = isRefund ? "refund" : "subscription_payment";
  const status = isRefund ? "refunded" : isFailed ? "failed" : "succeeded";
  const idempotencyKey = `${event.provider}:transaction:${event.transactionId}`;
  await db
    .prepare(
      `INSERT OR IGNORE INTO transaction_ledger (
         id, user_id, provider, provider_transaction_id, subscription_id,
         kind, amount_minor, currency, status, idempotency_key, metadata_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      userId,
      event.provider,
      event.transactionId,
      event.subscriptionId,
      kind,
      event.amountMinor,
      event.currency,
      status,
      idempotencyKey,
      JSON.stringify({ billingEventId: event.eventId })
    )
    .run();

  if (event.subscriptionId && existingSubscription) {
    const subscriptionStatus = isFailed || isRefund ? "past_due" : "active";
    await db
      .prepare(
        `UPDATE pro_subscriptions
         SET status = ?, updated_at = datetime('now')
         WHERE provider = ? AND provider_subscription_id = ?`
      )
      .bind(subscriptionStatus, event.provider, event.subscriptionId)
      .run();
  }
  return { userId, subscriptionId: event.subscriptionId };
}

export async function processBillingEvent(input: {
  event: NormalizedBillingEvent;
  payloadHash: string;
}): Promise<{ duplicate: boolean; userId: string | null; subscriptionId: string | null }> {
  if (!/^[0-9a-f]{64}$/i.test(input.payloadHash)) {
    throw new Error("Invalid billing payload hash");
  }
  const db = await getDb();
  const existing = await db
    .prepare(
      `SELECT id, payload_hash, status, user_id, subscription_id
       FROM billing_events WHERE provider = ? AND event_id = ?`
    )
    .bind(input.event.provider, input.event.eventId)
    .first<{
      id: string;
      payload_hash: string;
      status: "received" | "processed" | "ignored" | "failed";
      user_id: string | null;
      subscription_id: string | null;
    }>();

  if (existing && existing.payload_hash !== input.payloadHash) {
    throw new Error("Billing event payload mismatch");
  }
  if (existing && (existing.status === "processed" || existing.status === "ignored")) {
    return {
      duplicate: true,
      userId: existing.user_id,
      subscriptionId: existing.subscription_id,
    };
  }

  const eventRowId = existing?.id ?? crypto.randomUUID();
  await db
    .prepare(
      `INSERT OR IGNORE INTO billing_events (
         id, provider, event_id, event_type, payload_hash, status
       ) VALUES (?, ?, ?, ?, ?, 'received')`
    )
    .bind(
      eventRowId,
      input.event.provider,
      input.event.eventId,
      input.event.type,
      input.payloadHash
    )
    .run();

  try {
    const result = input.event.type.startsWith("subscription.")
      ? await applySubscriptionEvent(input.event)
      : await applyTransactionEvent(input.event);
    await db
      .prepare(
        `UPDATE billing_events
         SET status = 'processed', user_id = ?, subscription_id = ?,
             error = NULL, processed_at = datetime('now')
         WHERE provider = ? AND event_id = ?`
      )
      .bind(
        result.userId,
        result.subscriptionId,
        input.event.provider,
        input.event.eventId
      )
      .run();
    return {
      duplicate: false,
      userId: result.userId,
      subscriptionId: result.subscriptionId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message.slice(0, 160) : "Billing processing failed";
    await db
      .prepare(
        `UPDATE billing_events
         SET status = 'failed', error = ?, processed_at = NULL
         WHERE provider = ? AND event_id = ?`
      )
      .bind(errorMessage, input.event.provider, input.event.eventId)
      .run();
    throw error;
  }
}
