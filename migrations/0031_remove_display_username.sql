-- displayUsername was a Better Auth username-plugin compatibility field.
-- Public identity uses user.name and user.username only.
ALTER TABLE "user" DROP COLUMN displayUsername;
