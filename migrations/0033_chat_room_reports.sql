-- Conversation-level DM reports with a frozen moderation context cutoff.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS chat_room_reports (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES chat_rooms (id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  reported_user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (
    reason IN ('spam', 'harassment', 'hate', 'misinformation', 'nsfw', 'other')
  ),
  details TEXT,
  context_until TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewed', 'dismissed')),
  reviewed_by TEXT REFERENCES "user" (id) ON DELETE SET NULL,
  reviewed_at TEXT,
  resolution_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (room_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_room_reports_status
  ON chat_room_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_room_reports_room
  ON chat_room_reports (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_room_reports_reported_user
  ON chat_room_reports (reported_user_id, status, created_at DESC);
