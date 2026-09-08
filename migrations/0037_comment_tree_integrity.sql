PRAGMA foreign_keys = ON;

-- Legacy deletion wrote both flags. Keep any parent with a live child in the
-- logical tree while preserving the author-deleted tombstone marker.
UPDATE comments
SET is_removed = 0,
    body = '[deleted]',
    updated_at = datetime('now')
WHERE is_deleted = 1
  AND is_removed = 1
  AND EXISTS (
    SELECT 1
    FROM comments child
    WHERE child.parent_id = comments.id
      AND child.is_removed = 0
  );

-- Reconcile the denormalized public comment count after legacy deletions.
UPDATE posts
SET comment_count = (
  SELECT COUNT(*)
  FROM comments
  WHERE comments.post_id = posts.id
    AND comments.is_deleted = 0
    AND comments.is_removed = 0
    AND comments.is_shadow_hidden = 0
);
