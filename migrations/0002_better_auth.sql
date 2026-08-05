-- Better Auth core tables + app profile fields on user
-- Migrates content FKs from legacy `users` to Better Auth `user`

PRAGMA foreign_keys = OFF;

-- ---------------------------------------------------------------------------
-- Better Auth: user
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
  image TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- username plugin
  username TEXT UNIQUE COLLATE NOCASE,
  display_username TEXT,
  -- red app fields
  karma INTEGER NOT NULL DEFAULT 0,
  post_karma INTEGER NOT NULL DEFAULT 0,
  comment_karma INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned', 'shadowbanned')),
  bio TEXT
);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY NOT NULL,
  expires_at TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at TEXT,
  refresh_token_expires_at TEXT,
  scope TEXT,
  password TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_session_user ON session (user_id);
CREATE INDEX IF NOT EXISTS idx_account_user ON account (user_id);
CREATE INDEX IF NOT EXISTS idx_user_username ON "user" (username);
CREATE INDEX IF NOT EXISTS idx_user_status ON "user" (status);

-- ---------------------------------------------------------------------------
-- Copy legacy users → user (best-effort for local seed continuity)
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO "user" (
  id, name, email, email_verified, username, display_username, karma, role, status, created_at, updated_at
)
SELECT
  id,
  COALESCE(display_name, username),
  lower(username) || '@example.local',
  1,
  username,
  username,
  karma,
  'user',
  'active',
  created_at,
  updated_at
FROM users;

-- Recreate FK-bearing tables against `user`
CREATE TABLE posts_new (
  id TEXT PRIMARY KEY NOT NULL,
  subreddit_id TEXT NOT NULL REFERENCES subreddits (id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
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
  is_removed INTEGER NOT NULL DEFAULT 0 CHECK (is_removed IN (0, 1)),
  is_shadow_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_shadow_hidden IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO posts_new
SELECT
  id, subreddit_id, author_id, title, body, url, media_key,
  upvotes, downvotes, score, comment_count, is_nsfw, is_locked,
  0, 0, created_at, updated_at
FROM posts;

DROP TABLE posts;
ALTER TABLE posts_new RENAME TO posts;

CREATE TABLE comments_new (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES comments_new (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  upvotes INTEGER NOT NULL DEFAULT 0 CHECK (upvotes >= 0),
  downvotes INTEGER NOT NULL DEFAULT 0 CHECK (downvotes >= 0),
  score INTEGER NOT NULL DEFAULT 0,
  depth INTEGER NOT NULL DEFAULT 0 CHECK (depth >= 0),
  is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  is_removed INTEGER NOT NULL DEFAULT 0 CHECK (is_removed IN (0, 1)),
  is_shadow_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_shadow_hidden IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO comments_new
SELECT
  id, post_id, author_id, parent_id, body,
  upvotes, downvotes, score, depth, is_deleted,
  0, 0, created_at, updated_at
FROM comments;

DROP TABLE comments;
ALTER TABLE comments_new RENAME TO comments;

CREATE TABLE votes_new (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  voter_karma_at_vote INTEGER NOT NULL DEFAULT 0,
  weight REAL NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, target_type, target_id)
);

INSERT OR IGNORE INTO votes_new (id, user_id, target_type, target_id, value, created_at, updated_at)
SELECT id, user_id, target_type, target_id, value, created_at, updated_at FROM votes;

DROP TABLE votes;
ALTER TABLE votes_new RENAME TO votes;

CREATE TABLE subscriptions_new (
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  subreddit_id TEXT NOT NULL REFERENCES subreddits (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, subreddit_id)
);

INSERT OR IGNORE INTO subscriptions_new SELECT * FROM subscriptions;
DROP TABLE subscriptions;
ALTER TABLE subscriptions_new RENAME TO subscriptions;

-- Fix subreddits.created_by FK target
CREATE TABLE subreddits_new (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  banner_url TEXT,
  created_by TEXT REFERENCES "user" (id) ON DELETE SET NULL,
  subscriber_count INTEGER NOT NULL DEFAULT 0,
  is_removed INTEGER NOT NULL DEFAULT 0 CHECK (is_removed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO subreddits_new
SELECT id, name, title, description, icon_url, banner_url, created_by, subscriber_count, 0, created_at, updated_at
FROM subreddits;

DROP TABLE subreddits;
ALTER TABLE subreddits_new RENAME TO subreddits;

DROP TABLE IF EXISTS users;

-- Recreate indexes
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

PRAGMA foreign_keys = ON;
