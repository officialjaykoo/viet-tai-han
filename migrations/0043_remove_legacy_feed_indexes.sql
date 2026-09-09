-- Remove indexes left behind by the pre-canonical score/feed and comment-tree queries.
-- Canonical feed and comment projections use 0042 indexes; author and parent
-- lookups retain their dedicated indexes.
DROP INDEX IF EXISTS idx_posts_feed;
DROP INDEX IF EXISTS idx_posts_score;
DROP INDEX IF EXISTS idx_posts_subreddit_created;
DROP INDEX IF EXISTS idx_comments_post_created;
DROP INDEX IF EXISTS idx_comments_thread;
