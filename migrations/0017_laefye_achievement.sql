-- Easter egg achievement: mention "laefye" in a post or comment
INSERT OR IGNORE INTO achievements (
  id, slug, title, description, kind, category, max_level, sort_order
) VALUES (
  'ach_laefye',
  'laefye',
  'laefye',
  'You spoke the name in a post or comment.',
  'achievement',
  'easter_egg',
  1,
  400
);
