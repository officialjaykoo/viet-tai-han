PRAGMA foreign_keys = ON;

-- Allow karma to go negative (needed for post-creation gates).
-- Messaging + chat-request approval (anti-spam).

CREATE TABLE IF NOT EXISTS chat_rooms (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL DEFAULT 'dm' CHECK (kind IN ('dm')),
  pair_key TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_message_at TEXT
);

CREATE TABLE IF NOT EXISTS chat_room_members (
  room_id TEXT NOT NULL REFERENCES chat_rooms (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'owner')),
  membership_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (membership_status IN ('pending', 'active', 'declined', 'left')),
  joined_at TEXT,
  last_read_at TEXT,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_requests (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES chat_rooms (id) ON DELETE CASCADE,
  from_user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  to_user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  opener_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_requests_open_pair
  ON chat_requests (from_user_id, to_user_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES chat_rooms (id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  -- Held until the recipient accepts the chat request
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'delivered')),
  is_shadow_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_shadow_hidden IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_members_user
  ON chat_room_members (user_id, membership_status);
CREATE INDEX IF NOT EXISTS idx_chat_requests_to
  ON chat_requests (to_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room
  ON chat_messages (room_id, created_at DESC);

INSERT OR IGNORE INTO site_settings (key, value) VALUES
  ('min_karma_to_dm', '1'),
  ('min_karma_to_create_community', '5'),
  ('max_dm_requests_per_hour', '5'),
  ('max_dm_messages_per_hour', '60');
