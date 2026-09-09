PRAGMA foreign_keys = ON;

-- Public feed ordering uses the canonical like/comment counters, not legacy score fields.
CREATE INDEX IF NOT EXISTS idx_posts_public_engagement_rank
  ON posts (
    is_removed,
    is_shadow_hidden,
    (like_count + (comment_count * 3)) DESC,
    created_at DESC,
    id DESC
  );

CREATE INDEX IF NOT EXISTS idx_posts_public_created
  ON posts (is_removed, is_shadow_hidden, subreddit_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_comments_public_post
  ON comments (
    post_id,
    is_shadow_hidden,
    is_removed,
    is_deleted,
    created_at ASC,
    id ASC
  );
