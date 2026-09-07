PRAGMA foreign_keys = ON;

-- Nullable request IDs preserve existing rows while making retried writes safe.
ALTER TABLE posts ADD COLUMN request_id TEXT;
ALTER TABLE comments ADD COLUMN request_id TEXT;
ALTER TABLE chat_requests ADD COLUMN request_id TEXT;
ALTER TABLE chat_messages ADD COLUMN request_id TEXT;
ALTER TABLE listings ADD COLUMN request_id TEXT;
ALTER TABLE questions ADD COLUMN request_id TEXT;
ALTER TABLE answers ADD COLUMN request_id TEXT;
ALTER TABLE businesses ADD COLUMN request_id TEXT;
ALTER TABLE business_bookings ADD COLUMN request_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_author_request
  ON posts (author_id, request_id)
  WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_comments_author_request
  ON comments (author_id, request_id)
  WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_requests_sender_request
  ON chat_requests (from_user_id, request_id)
  WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_sender_request
  ON chat_messages (sender_id, request_id)
  WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_seller_request
  ON listings (seller_id, request_id)
  WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_author_request
  ON questions (author_id, request_id)
  WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_answers_author_request
  ON answers (author_id, request_id)
  WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_owner_request
  ON businesses (owner_id, request_id)
  WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_requester_request
  ON business_bookings (requester_id, request_id)
  WHERE request_id IS NOT NULL;

INSERT OR IGNORE INTO site_settings (key, value)
VALUES
  ('max_likes_per_hour', '120'),
  ('max_likes_burst_per_min', '30');
