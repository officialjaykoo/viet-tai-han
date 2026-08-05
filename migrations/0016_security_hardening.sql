-- Security rate events (user + IP subjects; no FK so guests can be limited)
CREATE TABLE IF NOT EXISTS security_rate_events (
  id TEXT PRIMARY KEY NOT NULL,
  subject TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_security_rate_subject_action
  ON security_rate_events (subject, action, created_at DESC);

-- Tighten default quotas (admins can still override via site_settings)
INSERT INTO site_settings (key, value) VALUES
  ('max_posts_per_hour', '5'),
  ('max_comments_per_hour', '15'),
  ('max_votes_per_hour', '60'),
  ('max_dm_requests_per_hour', '3'),
  ('max_dm_messages_per_hour', '30'),
  ('max_posts_burst_per_min', '2'),
  ('max_comments_burst_per_min', '4'),
  ('max_votes_burst_per_min', '12'),
  ('max_api_mutate_per_min', '30'),
  ('max_api_mutate_per_hour', '120'),
  ('max_api_mutate_ip_per_min', '40'),
  ('max_api_mutate_ip_per_hour', '180')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
