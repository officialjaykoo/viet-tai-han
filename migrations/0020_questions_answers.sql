-- Phase 2: questions, answers, and accepted-answer state

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY NOT NULL,
  subreddit_id TEXT NOT NULL REFERENCES subreddits (id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  answer_count INTEGER NOT NULL DEFAULT 0 CHECK (answer_count >= 0),
  accepted_answer_id TEXT,
  is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0, 1)),
  is_removed INTEGER NOT NULL DEFAULT 0 CHECK (is_removed IN (0, 1)),
  is_shadow_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_shadow_hidden IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS answers (
  id TEXT PRIMARY KEY NOT NULL,
  question_id TEXT NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_accepted INTEGER NOT NULL DEFAULT 0 CHECK (is_accepted IN (0, 1)),
  is_removed INTEGER NOT NULL DEFAULT 0 CHECK (is_removed IN (0, 1)),
  is_shadow_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_shadow_hidden IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_questions_feed
  ON questions (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_questions_subreddit
  ON questions (subreddit_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_questions_author
  ON questions (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_accepted
  ON questions (accepted_answer_id);
CREATE INDEX IF NOT EXISTS idx_answers_question
  ON answers (question_id, is_accepted DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_answers_author
  ON answers (author_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_answers_one_accepted
  ON answers (question_id)
  WHERE is_accepted = 1 AND is_removed = 0 AND is_shadow_hidden = 0;

INSERT OR IGNORE INTO site_settings (key, value) VALUES
  ('max_questions_per_hour', '5'),
  ('max_answers_per_hour', '30'),
  ('max_questions_burst_per_min', '2'),
  ('max_answers_burst_per_min', '6');
