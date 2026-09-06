-- New accounts may send chat requests; abuse controls remain in place.
INSERT INTO site_settings (key, value)
VALUES ('min_karma_to_dm', '0')
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = datetime('now'),
  updated_by = NULL;
