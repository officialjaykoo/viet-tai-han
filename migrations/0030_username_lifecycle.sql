-- Username candidates are kept separate from the temporary Better Auth username.
ALTER TABLE "user" ADD COLUMN onboardingUsernameCandidate TEXT;

-- NULL means the user has never changed the username after onboarding.
ALTER TABLE "user" ADD COLUMN usernameChangedAt TEXT;

-- Historical handles preserve redirects and remain reserved for a finite hold.
CREATE TABLE IF NOT EXISTS username_history (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  username TEXT NOT NULL COLLATE NOCASE,
  changedAt TEXT NOT NULL,
  reservedUntil TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_username_history_lookup
  ON username_history (username COLLATE NOCASE, changedAt DESC);

CREATE INDEX IF NOT EXISTS idx_username_history_user
  ON username_history (userId, changedAt DESC);
