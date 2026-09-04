-- Store the target locale explicitly so translated content can be shown only to the right viewer.
ALTER TABLE posts ADD COLUMN translation_target_lang TEXT;
ALTER TABLE comments ADD COLUMN translation_target_lang TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_translation_target
  ON posts (translation_status, translation_target_lang);
CREATE INDEX IF NOT EXISTS idx_comments_translation_target
  ON comments (translation_status, translation_target_lang);

-- Discard translations produced for the retired en/ru UI pair. The content is
-- queued again by the multilingual backfill using the vi/ko target policy.
UPDATE posts
SET source_lang = NULL,
    title_translated = NULL,
    body_translated = NULL,
    translation_target_lang = NULL,
    translation_status = 'pending'
WHERE source_lang IN ('en', 'ru');

UPDATE comments
SET source_lang = NULL,
    body_translated = NULL,
    translation_target_lang = NULL,
    translation_status = 'pending'
WHERE source_lang IN ('en', 'ru');
