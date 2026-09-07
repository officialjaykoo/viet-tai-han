PRAGMA foreign_keys = ON;

-- Client-generated IDs make message retries safe without rewriting legacy rows.
ALTER TABLE chat_messages ADD COLUMN client_message_id TEXT;
ALTER TABLE chat_room_members ADD COLUMN last_read_message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_room_sender_client
  ON chat_messages (room_id, sender_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_order
  ON chat_messages (room_id, created_at DESC, id DESC);
