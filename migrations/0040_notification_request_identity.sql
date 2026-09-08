PRAGMA foreign_keys = ON;

-- Keep actionable request notifications tied to their canonical request entity.
-- Existing rows remain NULL and are handled as legacy notifications by cleanup.
ALTER TABLE notifications ADD COLUMN source_request_id TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_actionable
  ON notifications (user_id, actor_id, kind, source_request_id, is_read);
