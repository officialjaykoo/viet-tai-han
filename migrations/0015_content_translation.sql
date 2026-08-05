-- Post/comment auto-translation (en ↔ ru) via Workers AI

ALTER TABLE posts ADD COLUMN source_lang TEXT;
ALTER TABLE posts ADD COLUMN title_translated TEXT;
ALTER TABLE posts ADD COLUMN body_translated TEXT;
ALTER TABLE posts ADD COLUMN translation_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE comments ADD COLUMN source_lang TEXT;
ALTER TABLE comments ADD COLUMN body_translated TEXT;
ALTER TABLE comments ADD COLUMN translation_status TEXT NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_posts_translation_status
  ON posts (translation_status);
CREATE INDEX IF NOT EXISTS idx_comments_translation_status
  ON comments (translation_status);
