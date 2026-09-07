PRAGMA foreign_keys = ON;

-- New canonical interaction tables. The legacy votes/upvotes/downvotes/score
-- columns stay in place until production verification completes.
ALTER TABLE posts ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0);
ALTER TABLE comments ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id TEXT NOT NULL REFERENCES comments (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_user
  ON post_likes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user
  ON comment_likes (user_id, created_at DESC);

-- Migrate positive legacy votes only. Negative votes have no Like equivalent.
INSERT OR IGNORE INTO post_likes (post_id, user_id, created_at)
SELECT v.target_id, v.user_id, v.created_at
FROM votes v
INNER JOIN posts p ON p.id = v.target_id
INNER JOIN "user" u ON u.id = v.user_id
WHERE v.target_type = 'post' AND v.value = 1;

INSERT OR IGNORE INTO comment_likes (comment_id, user_id, created_at)
SELECT v.target_id, v.user_id, v.created_at
FROM votes v
INNER JOIN comments c ON c.id = v.target_id
INNER JOIN "user" u ON u.id = v.user_id
WHERE v.target_type = 'comment' AND v.value = 1;

UPDATE posts
SET like_count = (
  SELECT COUNT(*) FROM post_likes l WHERE l.post_id = posts.id
);

UPDATE comments
SET like_count = (
  SELECT COUNT(*) FROM comment_likes l WHERE l.comment_id = comments.id
);
