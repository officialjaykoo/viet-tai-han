-- Drop retired history only when it is empty. Achievement catalog rows are
-- migration-owned metadata; user grants and post views are data-gated.
-- If production still has grants or views, backup and compare them before
-- applying a follow-up migration; these guards prevent silent data loss.
PRAGMA foreign_keys = ON;

CREATE TRIGGER retire_user_achievements_guard
BEFORE DELETE ON user_achievements
WHEN EXISTS (SELECT 1 FROM user_achievements)
BEGIN
  SELECT RAISE(ABORT, 'user_achievements is not empty; backup and compare before removal');
END;
DELETE FROM user_achievements;
DROP TRIGGER retire_user_achievements_guard;


DROP TABLE user_achievements;
DROP TABLE achievements;

CREATE TRIGGER retire_post_views_guard
BEFORE DELETE ON post_views
WHEN EXISTS (SELECT 1 FROM post_views)
BEGIN
  SELECT RAISE(ABORT, 'post_views is not empty; backup and compare before removal');
END;
DELETE FROM post_views;
DROP TRIGGER retire_post_views_guard;

DROP TABLE post_views;
DROP TABLE IF EXISTS post_link_clicks;
