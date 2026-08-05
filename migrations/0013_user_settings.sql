PRAGMA foreign_keys = ON;

-- Profile banner (R2 media key or null for gradient fallback)
ALTER TABLE "user" ADD COLUMN bannerKey TEXT;

-- Appearance: system | light | dark
ALTER TABLE "user" ADD COLUMN theme TEXT NOT NULL DEFAULT 'system';

-- Feed: show NSFW-marked content
ALTER TABLE "user" ADD COLUMN showNsfw INTEGER NOT NULL DEFAULT 0;

-- Who can start a chat: anyone | followers | nobody
ALTER TABLE "user" ADD COLUMN allowDms TEXT NOT NULL DEFAULT 'anyone';

-- Notification toggles (1 = on)
ALTER TABLE "user" ADD COLUMN notifyComments INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "user" ADD COLUMN notifyFollows INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "user" ADD COLUMN notifyChat INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "user" ADD COLUMN notifyMentions INTEGER NOT NULL DEFAULT 1;
