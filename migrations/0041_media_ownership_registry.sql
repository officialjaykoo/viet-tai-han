PRAGMA foreign_keys = ON;

-- Track newly uploaded objects so an authenticated, age-based janitor can
-- remove only uploads that are no longer referenced by canonical records.
CREATE TABLE IF NOT EXISTS media_objects (
  media_key TEXT PRIMARY KEY NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_objects_cleanup
  ON media_objects (created_at, uploaded_by);
