PRAGMA foreign_keys = ON;

-- Preferred UI language: unknown | vi | ko (default unknown → language chooser)
ALTER TABLE "user" ADD COLUMN preferredLanguage TEXT NOT NULL DEFAULT 'unknown';
