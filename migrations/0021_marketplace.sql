-- Next phase: marketplace, jobs, services, saves, alerts, and scam reports

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY NOT NULL,
  seller_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('market', 'job', 'service')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  price TEXT,
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'sold', 'closed', 'removed')),
  is_shadow_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_shadow_hidden IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS listing_saves (
  listing_id TEXT NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (listing_id, user_id)
);

CREATE TABLE IF NOT EXISTS listing_alerts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  query TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, query, kind, category, location)
);

CREATE TABLE IF NOT EXISTS listing_reports (
  id TEXT PRIMARY KEY NOT NULL,
  listing_id TEXT NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('scam', 'prohibited', 'misleading', 'unsafe', 'other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewed', 'dismissed')),
  reviewed_by TEXT REFERENCES "user" (id) ON DELETE SET NULL,
  reviewed_at TEXT,
  resolution_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (listing_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_listings_feed
  ON listings (status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_listings_kind_category
  ON listings (kind, category, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_location
  ON listings (location, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_seller
  ON listings (seller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_saves_user
  ON listing_saves (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_alerts_user
  ON listing_alerts (user_id, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_reports_status
  ON listing_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_reports_listing
  ON listing_reports (listing_id, status, created_at DESC);

INSERT OR IGNORE INTO site_settings (key, value) VALUES
  ('max_listings_per_hour', '10'),
  ('max_listings_burst_per_min', '3');
