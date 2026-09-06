-- Social-first identity fields.
-- Better Auth's user.email remains for framework compatibility; it is not an identity key.

ALTER TABLE "user" ADD COLUMN contactEmail TEXT;
ALTER TABLE "user" ADD COLUMN contactEmailVerified INTEGER NOT NULL DEFAULT 0 CHECK (contactEmailVerified IN (0, 1));
ALTER TABLE "user" ADD COLUMN onboardingComplete INTEGER NOT NULL DEFAULT 0 CHECK (onboardingComplete IN (0, 1));

-- Existing accounts already completed the legacy profile flow. New OAuth users keep 0.
UPDATE "user" SET onboardingComplete = 1 WHERE onboardingComplete = 0;

-- A provider/account pair is the canonical external identity and must belong to one user.
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_provider_account
  ON account (providerId, accountId);
