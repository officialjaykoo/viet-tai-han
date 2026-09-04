-- Mutual friend requests and accepted friendships.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS notifications_0027 (
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
    'mention',
    'friend_request',
    'friend_accepted'
  )),
  title TEXT NOT NULL,
  body TEXT,
  href TEXT,
  post_id TEXT REFERENCES posts (id) ON DELETE SET NULL,
  comment_id TEXT REFERENCES comments (id) ON DELETE SET NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO notifications_0027 (
  id, user_id, actor_id, kind, title, body, href, post_id, comment_id,
  is_read, created_at
)
SELECT
  id, user_id, actor_id, kind, title, body, href, post_id, comment_id,
  is_read, created_at
FROM notifications;

DROP TABLE notifications;
ALTER TABLE notifications_0027 RENAME TO notifications;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_friendships (
  id TEXT PRIMARY KEY NOT NULL,
  pair_key TEXT NOT NULL UNIQUE,
  requester_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  addressee_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (requester_id != addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_user_friendships_addressee_status
  ON user_friendships (addressee_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_friendships_requester_status
  ON user_friendships (requester_id, status, created_at DESC);
