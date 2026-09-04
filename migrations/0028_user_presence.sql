-- Track recent signed-in activity for the live online people list.
CREATE TABLE IF NOT EXISTS user_presence (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen
  ON user_presence (last_seen_at DESC);
