-- Push subscriptions, unread fanout, and DM moderation.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  last_success_at TEXT,
  disabled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions (user_id, disabled_at, updated_at DESC);

ALTER TABLE chat_messages
  ADD COLUMN is_moderation_hidden INTEGER NOT NULL DEFAULT 0
  CHECK (is_moderation_hidden IN (0, 1));

CREATE TABLE IF NOT EXISTS chat_message_reports (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL REFERENCES chat_messages (id) ON DELETE CASCADE,
  room_id TEXT NOT NULL REFERENCES chat_rooms (id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (
    reason IN ('spam', 'harassment', 'hate', 'misinformation', 'nsfw', 'other')
  ),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewed', 'dismissed')),
  reviewed_by TEXT REFERENCES "user" (id) ON DELETE SET NULL,
  reviewed_at TEXT,
  resolution_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (message_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_message_reports_status
  ON chat_message_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_message_reports_room
  ON chat_message_reports (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_message_reports_message
  ON chat_message_reports (message_id, status);

CREATE TABLE IF NOT EXISTS unread_fanout (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  notification_count INTEGER NOT NULL DEFAULT 0 CHECK (notification_count >= 0),
  message_count INTEGER NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO unread_fanout (user_id, notification_count, message_count)
SELECT
  u.id,
  COALESCE((
    SELECT COUNT(*)
    FROM notifications n
    WHERE n.user_id = u.id AND n.is_read = 0
  ), 0),
  COALESCE((
    SELECT COUNT(*)
    FROM chat_messages cm
    INNER JOIN chat_room_members rm
      ON rm.room_id = cm.room_id AND rm.user_id = u.id
    WHERE rm.membership_status = 'active'
      AND cm.sender_id != u.id
      AND cm.delivery_status = 'delivered'
      AND cm.is_shadow_hidden = 0
      AND cm.is_moderation_hidden = 0
      AND (
        rm.last_read_at IS NULL
        OR cm.created_at > rm.last_read_at
      )
  ), 0)
FROM "user" u;

CREATE INDEX IF NOT EXISTS idx_unread_fanout_updated
  ON unread_fanout (updated_at DESC);

INSERT OR IGNORE INTO site_settings (key, value) VALUES
  ('max_dm_reports_per_hour', '20'),
  ('max_dm_reports_burst_per_min', '5');
