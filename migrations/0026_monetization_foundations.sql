PRAGMA foreign_keys = ON;

-- Explicit, versioned consent. Analytics and personalized advertising are opt-in.
CREATE TABLE IF NOT EXISTS user_consents (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  consent_version TEXT NOT NULL,
  analytics INTEGER NOT NULL DEFAULT 0 CHECK (analytics IN (0, 1)),
  personalized_ads INTEGER NOT NULL DEFAULT 0 CHECK (personalized_ads IN (0, 1)),
  marketing INTEGER NOT NULL DEFAULT 0 CHECK (marketing IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Provider-neutral entitlement state. Checkout/provider adapters are intentionally external.
CREATE TABLE IF NOT EXISTS pro_subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual', 'lifetime')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'past_due', 'canceled', 'expired')),
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK (cancel_at_period_end IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_subscription_id)
);

-- Only normalized metadata and payload hash are retained; raw provider payloads stay out of D1.
CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  user_id TEXT REFERENCES "user" (id) ON DELETE SET NULL,
  subscription_id TEXT,
  error TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, event_id)
);

-- Monetary audit trail. Amounts are integer minor units, never floating point.
CREATE TABLE IF NOT EXISTS transaction_ledger (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT,
  subscription_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('subscription_payment', 'refund', 'adjustment')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_transaction_id)
);

-- Auditable reputation events. Existing aggregate karma is opened below.
CREATE TABLE IF NOT EXISTS reputation_ledger (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  source_type TEXT,
  source_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Existing impressions remain valid. New writes get a privacy-safe per-user/day dedupe key.
ALTER TABLE ad_impressions ADD COLUMN dedupe_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_impressions_dedupe
  ON ad_impressions (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_consents_updated
  ON user_consents (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pro_subscriptions_user_status
  ON pro_subscriptions (user_id, status, current_period_end);
CREATE INDEX IF NOT EXISTS idx_billing_events_status_time
  ON billing_events (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_ledger_user_time
  ON transaction_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_ledger_user_time
  ON reputation_ledger (user_id, created_at DESC);

-- Ads stay disabled until the operator confirms policy, consent, and anti-fraud readiness.
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('ads_enabled', '0');

-- Make the pre-ledger aggregate auditable without changing the current balance.
INSERT OR IGNORE INTO reputation_ledger (
  id,
  user_id,
  event_type,
  amount,
  source_type,
  source_id,
  idempotency_key,
  metadata_json
)
SELECT
  'opening_' || id,
  id,
  'opening_balance',
  karma,
  'migration',
  '0026_monetization_foundations',
  'migration:0026:opening:' || id,
  '{"source":"legacy_user_karma"}'
FROM "user"
WHERE karma <> 0;
