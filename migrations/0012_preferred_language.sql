PRAGMA foreign_keys = ON;

-- Preferred UI language: unknown | en | ru (default unknown → language chooser)
ALTER TABLE "user" ADD COLUMN preferredLanguage TEXT NOT NULL DEFAULT 'unknown';
