-- Retire unused reputation, NSFW, and email-verification scaffolding.
-- Back up production before applying this destructive schema change.
PRAGMA foreign_keys = ON;

ALTER TABLE "user" DROP COLUMN karma;
ALTER TABLE "user" DROP COLUMN postKarma;
ALTER TABLE "user" DROP COLUMN commentKarma;
ALTER TABLE "user" DROP COLUMN isNsfw;
ALTER TABLE "user" DROP COLUMN showNsfw;
ALTER TABLE "user" DROP COLUMN contactEmailVerified;
