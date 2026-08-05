PRAGMA foreign_keys = ON;

-- Outbound link clicks for author CTR analytics
CREATE TABLE IF NOT EXISTS post_link_clicks (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  viewer_id TEXT REFERENCES "user" (id) ON DELETE SET NULL,
  session_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_post_link_clicks_post
  ON post_link_clicks (post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_views_referrer
  ON post_views (post_id, referrer_host);
