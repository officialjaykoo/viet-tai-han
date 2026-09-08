PRAGMA foreign_keys = ON;

-- Declined/cancelled requests must never release their held opener later.
DELETE FROM chat_messages
WHERE delivery_status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM chat_requests r
    WHERE r.room_id = chat_messages.room_id
      AND r.from_user_id = chat_messages.sender_id
      AND r.status IN ('declined', 'cancelled')
      AND (
        chat_messages.request_id = r.request_id
        OR (
          chat_messages.request_id IS NULL
          AND r.request_id IS NULL
        )
      )
  );

-- Keep the oldest pending request in each room and cancel the rest before
-- adding the room-level uniqueness invariant.
UPDATE chat_requests
SET status = 'cancelled',
    responded_at = COALESCE(responded_at, datetime('now'))
WHERE status = 'pending'
  AND id <> (
    SELECT keeper.id
    FROM chat_requests keeper
    WHERE keeper.room_id = chat_requests.room_id
      AND keeper.status = 'pending'
    ORDER BY keeper.created_at ASC, keeper.id ASC
    LIMIT 1
  );

DELETE FROM chat_messages
WHERE delivery_status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM chat_requests r
    WHERE r.room_id = chat_messages.room_id
      AND r.from_user_id = chat_messages.sender_id
      AND r.status = 'cancelled'
      AND (
        chat_messages.request_id = r.request_id
        OR (
          chat_messages.request_id IS NULL
          AND r.request_id IS NULL
        )
      )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_requests_room_pending
  ON chat_requests (room_id)
  WHERE status = 'pending';
