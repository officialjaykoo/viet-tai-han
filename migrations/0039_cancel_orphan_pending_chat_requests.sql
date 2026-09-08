PRAGMA foreign_keys = ON;

-- A pending request is valid while its matching opener exists.
-- Hidden openers still exist; migration checks existence, not visibility.
UPDATE chat_requests
SET status = 'cancelled',
    responded_at = COALESCE(responded_at, datetime('now'))
WHERE status = 'pending'
  AND NOT EXISTS (
    SELECT 1
    FROM chat_messages m
    WHERE m.room_id = chat_requests.room_id
      AND m.sender_id = chat_requests.from_user_id
      AND m.delivery_status = 'pending'
      AND (
        (chat_requests.request_id IS NOT NULL
         AND m.request_id = chat_requests.request_id)
        OR (
          chat_requests.request_id IS NULL
          AND m.request_id IS NULL
        )
      )
  );

-- Reconcile only memberships held by the cancelled request. Preserve a
-- membership if another pending request still owns the room-level slot.
UPDATE chat_room_members
SET membership_status = 'declined',
    joined_at = NULL
WHERE membership_status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM chat_requests r
    WHERE r.room_id = chat_room_members.room_id
      AND r.to_user_id = chat_room_members.user_id
      AND r.status = 'cancelled'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM chat_requests r
    WHERE r.room_id = chat_room_members.room_id
      AND r.to_user_id = chat_room_members.user_id
      AND r.status = 'pending'
  );
