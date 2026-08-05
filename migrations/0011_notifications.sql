PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES "user" (id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'comment_on_post',
    'reply_to_comment',
    'follow',
    'chat_request',
    'chat_accepted',
    'warning',
    'mention'
  )),
  title TEXT NOT NULL,
  body TEXT,
  href TEXT,
  post_id TEXT REFERENCES posts (id) ON DELETE SET NULL,
  comment_id TEXT REFERENCES comments (id) ON DELETE SET NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);
