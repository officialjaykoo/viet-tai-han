-- Moderation, bans, banned words, site settings, recommendations support

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS moderation_actions (
  id TEXT PRIMARY KEY NOT NULL,
  actor_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  target_user_id TEXT REFERENCES "user" (id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'post', 'comment', 'subreddit')),
  target_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'ban', 'unban', 'warn', 'shadowban', 'unshadowban',
    'remove', 'restore', 'delete_account', 'delete_subreddit'
  )),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_warnings (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  issued_by TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS banned_words (
  id TEXT PRIMARY KEY NOT NULL,
  word TEXT NOT NULL UNIQUE COLLATE NOCASE,
  severity TEXT NOT NULL DEFAULT 'shadow' CHECK (severity IN ('shadow', 'block')),
  created_by TEXT REFERENCES "user" (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT REFERENCES "user" (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS subreddit_moderators (
  subreddit_id TEXT NOT NULL REFERENCES subreddits (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (subreddit_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_activity (
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  subreddit_id TEXT NOT NULL REFERENCES subreddits (id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  last_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, subreddit_id)
);

INSERT OR IGNORE INTO site_settings (key, value) VALUES
  ('site_name', 'red'),
  ('registration_open', 'true'),
  ('min_account_age_hours_to_post', '0'),
  ('max_posts_per_hour', '10'),
  ('max_comments_per_hour', '30'),
  ('max_votes_per_hour', '120');

CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window
  ON rate_limits (user_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_user ON moderation_actions (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_warnings_user ON user_warnings (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_banned_words_word ON banned_words (word);
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity (user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_sub ON user_activity (subreddit_id, score DESC);
