-- red D1 schema
-- SQLite / Cloudflare D1

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT UNIQUE COLLATE NOCASE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  karma INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subreddits (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  banner_url TEXT,
  created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  subscriber_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY NOT NULL,
  subreddit_id TEXT NOT NULL REFERENCES subreddits (id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  media_key TEXT,
  upvotes INTEGER NOT NULL DEFAULT 0 CHECK (upvotes >= 0),
  downvotes INTEGER NOT NULL DEFAULT 0 CHECK (downvotes >= 0),
  score INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
  is_nsfw INTEGER NOT NULL DEFAULT 0 CHECK (is_nsfw IN (0, 1)),
  is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Nested comment threads via self-referential parent_id
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES comments (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  upvotes INTEGER NOT NULL DEFAULT 0 CHECK (upvotes >= 0),
  downvotes INTEGER NOT NULL DEFAULT 0 CHECK (downvotes >= 0),
  score INTEGER NOT NULL DEFAULT 0,
  depth INTEGER NOT NULL DEFAULT 0 CHECK (depth >= 0),
  is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  subreddit_id TEXT NOT NULL REFERENCES subreddits (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, subreddit_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

CREATE INDEX IF NOT EXISTS idx_subreddits_name ON subreddits (name);

CREATE INDEX IF NOT EXISTS idx_posts_feed ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_score ON posts (score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_subreddit_created ON posts (subreddit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts (author_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments (post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_thread ON comments (post_id, parent_id, score DESC);

CREATE INDEX IF NOT EXISTS idx_votes_target ON votes (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON votes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_subreddit ON subscriptions (subreddit_id);
