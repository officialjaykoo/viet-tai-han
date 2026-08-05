-- Account tags (NSFW) + achievements

PRAGMA foreign_keys = ON;

ALTER TABLE "user" ADD COLUMN isNsfw INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'achievement'
    CHECK (kind IN ('tag', 'achievement')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements (id) ON DELETE CASCADE,
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user
  ON user_achievements (user_id, earned_at DESC);

INSERT OR IGNORE INTO achievements (id, slug, title, description, kind, sort_order) VALUES
  ('ach_admin', 'admin', 'Admin', 'Site administrator', 'tag', 10),
  ('ach_moderator', 'moderator', 'Moderator', 'Community or site moderator', 'tag', 20),
  ('ach_veteran', 'veteran', 'Veteran', 'Long-standing member of red', 'tag', 30),
  ('ach_nsfw', 'nsfw', 'NSFW', 'Profile marked as NSFW', 'tag', 40),
  ('ach_first_post', 'first_post', 'First Post', 'Published your first post', 'achievement', 100),
  ('ach_first_comment', 'first_comment', 'First Comment', 'Left your first comment', 'achievement', 110),
  ('ach_karma_100', 'karma_100', 'Karma 100', 'Reached 100 karma', 'achievement', 120),
  ('ach_karma_1000', 'karma_1000', 'Karma 1K', 'Reached 1,000 karma', 'achievement', 130),
  ('ach_community', 'community_builder', 'Community Builder', 'Created a community', 'achievement', 140);
