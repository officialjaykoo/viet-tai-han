-- Private viewer controls: saved posts and muted authors.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS post_saves (
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_post_saves_user_created
  ON post_saves (user_id, created_at DESC, post_id DESC);
CREATE INDEX IF NOT EXISTS idx_post_saves_post
  ON post_saves (post_id);

CREATE TABLE IF NOT EXISTS user_mutes (
  muter_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  muted_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (muter_id, muted_id),
  CHECK (muter_id != muted_id)
);

CREATE INDEX IF NOT EXISTS idx_user_mutes_muter_created
  ON user_mutes (muter_id, created_at DESC, muted_id);
CREATE INDEX IF NOT EXISTS idx_user_mutes_muted
  ON user_mutes (muted_id);
