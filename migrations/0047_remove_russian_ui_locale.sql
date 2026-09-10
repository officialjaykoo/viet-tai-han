PRAGMA foreign_keys = ON;

UPDATE "user"
SET preferredLanguage = 'unknown', updatedAt = datetime('now')
WHERE preferredLanguage = 'ru';
