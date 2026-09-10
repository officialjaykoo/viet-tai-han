-- Remove feature tables whose runtime and production data are retired.
-- Production rollout requires the previously recorded zero-row audit plus a
-- backup and foreign-key check; this migration is intentionally forward-only.
PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS ad_clicks;
DROP TABLE IF EXISTS ad_impressions;
DROP TABLE IF EXISTS ad_campaigns;
DROP TABLE IF EXISTS user_consents;
DROP TABLE IF EXISTS pro_subscriptions;
DROP TABLE IF EXISTS billing_events;
DROP TABLE IF EXISTS transaction_ledger;
DROP TABLE IF EXISTS reputation_ledger;

DELETE FROM site_settings
WHERE key IN (
  'ads_enabled',
  'min_karma_to_dm',
  'min_karma_to_create_community',
  'min_karma_to_media',
  'min_age_hours_to_media'
);
