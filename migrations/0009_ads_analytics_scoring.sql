PRAGMA foreign_keys = ON;

-- Ads
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  placement TEXT NOT NULL DEFAULT 'feed_inline'
    CHECK (placement IN ('feed_inline', 'sidebar', 'post_footer')),
  body TEXT,
  image_key TEXT,
  target_url TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1 CHECK (weight >= 1),
  starts_at TEXT,
  ends_at TEXT,
  created_by TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ad_impressions (
  id TEXT PRIMARY KEY NOT NULL,
  campaign_id TEXT NOT NULL REFERENCES ad_campaigns (id) ON DELETE CASCADE,
  viewer_id TEXT REFERENCES "user" (id) ON DELETE SET NULL,
  placement TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ad_clicks (
  id TEXT PRIMARY KEY NOT NULL,
  campaign_id TEXT NOT NULL REFERENCES ad_campaigns (id) ON DELETE CASCADE,
  viewer_id TEXT REFERENCES "user" (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_active
  ON ad_campaigns (status, placement, weight);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_campaign
  ON ad_impressions (campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_campaign
  ON ad_clicks (campaign_id, created_at DESC);

-- Post views / discovery (analytics + vote-source trust)
CREATE TABLE IF NOT EXISTS post_views (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  viewer_id TEXT REFERENCES "user" (id) ON DELETE SET NULL,
  session_key TEXT NOT NULL,
  discovery_source TEXT NOT NULL DEFAULT 'unknown'
    CHECK (discovery_source IN (
      'home', 'popular', 'community', 'profile', 'search',
      'direct', 'shared', 'unknown'
    )),
  referrer_host TEXT,
  day_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_views_dedupe
  ON post_views (post_id, session_key, day_key);
CREATE INDEX IF NOT EXISTS idx_post_views_post
  ON post_views (post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_views_viewer_post
  ON post_views (post_id, viewer_id, created_at DESC);

-- Vote integrity event log (velocity / brigade detection)
CREATE TABLE IF NOT EXISTS vote_events (
  id TEXT PRIMARY KEY NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  weight REAL NOT NULL DEFAULT 0,
  voter_karma INTEGER NOT NULL DEFAULT 0,
  discovery_source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vote_events_target_time
  ON vote_events (target_type, target_id, created_at DESC);

-- Precomputed hot ranking (updated on vote)
ALTER TABLE posts ADD COLUMN hot_score REAL NOT NULL DEFAULT 0;

UPDATE posts
SET hot_score = (
  CASE
    WHEN score >= 0 THEN ln(1.0 + (CAST(score AS REAL) / 100.0))
    ELSE -ln(1.0 + (ABS(CAST(score AS REAL)) / 100.0))
  END
) / (((julianday('now') - julianday(created_at)) * 24.0) + 2.0);

INSERT OR IGNORE INTO site_settings (key, value) VALUES
  ('min_karma_to_media', '25'),
  ('min_age_hours_to_media', '24');
