PRAGMA foreign_keys = OFF;

-- Rebuild achievements catalog for levels + badge kinds
CREATE TABLE achievements_new (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'achievement'
    CHECK (kind IN ('tag', 'achievement', 'badge')),
  category TEXT NOT NULL DEFAULT 'general',
  max_level INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO achievements_new (id, slug, title, description, kind, category, max_level, sort_order, created_at)
SELECT
  id, slug, title, description, kind,
  CASE WHEN kind = 'tag' THEN 'status' ELSE 'milestone' END,
  1, sort_order, created_at
FROM achievements;

DROP TABLE achievements;
ALTER TABLE achievements_new RENAME TO achievements;

CREATE TABLE user_achievements_new (
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements (id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, achievement_id)
);

INSERT INTO user_achievements_new (user_id, achievement_id, level, earned_at, updated_at)
SELECT user_id, achievement_id, 1, earned_at, earned_at FROM user_achievements;

DROP TABLE user_achievements;
ALTER TABLE user_achievements_new RENAME TO user_achievements;

CREATE INDEX IF NOT EXISTS idx_user_achievements_user
  ON user_achievements (user_id, earned_at DESC);

PRAGMA foreign_keys = ON;

-- Expand catalog (levels + badges + new event trophies)
INSERT OR IGNORE INTO achievements (id, slug, title, description, kind, category, max_level, sort_order) VALUES
  -- Leveled content trophies
  ('ach_poster', 'poster', 'Poster', 'Publish posts to level up this trophy', 'achievement', 'content', 5, 200),
  ('ach_commenter', 'commenter', 'Commenter', 'Leave comments to level up this trophy', 'achievement', 'content', 5, 210),
  ('ach_karma_climber', 'karma_climber', 'Karma Climber', 'Grow your karma across the site', 'achievement', 'karma', 6, 220),
  ('ach_community_leader', 'community_leader', 'Community Leader', 'Create communities', 'achievement', 'community', 3, 230),
  ('ach_follower_magnet', 'follower_magnet', 'Follower Magnet', 'Earn followers on your profile', 'achievement', 'social', 4, 240),
  ('ach_social_butterfly', 'social_butterfly', 'Social Butterfly', 'Follow other members', 'achievement', 'social', 3, 250),
  ('ach_popular_post', 'popular_post', 'Crowd Favorite', 'Have a post reach a high score', 'achievement', 'content', 5, 260),
  ('ach_voter', 'voter', 'Voter', 'Cast votes across the site', 'achievement', 'engagement', 4, 270),
  ('ach_cake_day', 'cake_day', 'Cake Day', 'Celebrate another year on red', 'achievement', 'age', 10, 280),
  ('ach_conversationalist', 'conversationalist', 'Conversationalist', 'Get replies on your comments', 'achievement', 'social', 4, 290),
  ('ach_link_poster', 'link_poster', 'Link Sharer', 'Share link posts', 'achievement', 'content', 3, 300),
  ('ach_media_maven', 'media_maven', 'Media Maven', 'Share image posts', 'achievement', 'content', 3, 310),

  -- Status / one-shot milestones (keep legacy + add)
  ('ach_verified_start', 'welcome', 'Welcome Aboard', 'Created an account on red', 'achievement', 'milestone', 1, 90),
  ('ach_busy_bee', 'busy_bee', 'Busy Bee', 'Posted and commented on the same day', 'achievement', 'engagement', 1, 320),

  -- Display badges (highest level shown on profile)
  ('ach_badge_karma', 'badge_karma', 'Karma Badge', 'Rank badge based on total karma', 'badge', 'karma', 6, 50),
  ('ach_badge_age', 'badge_age', 'Member Since', 'Badge based on account age', 'badge', 'age', 6, 60);

-- Retire flat karma trophies into climber (keep rows for existing grants; hide via sort)
UPDATE achievements
SET description = 'Legacy trophy — see Karma Climber', sort_order = 999
WHERE slug IN ('karma_100', 'karma_1000');
