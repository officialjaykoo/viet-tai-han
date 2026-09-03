PRAGMA foreign_keys = ON;

-- Preserve existing choices after switching the supported UI locales to Vietnamese and Korean.
UPDATE "user" SET preferredLanguage = 'vi' WHERE preferredLanguage = 'en';
UPDATE "user" SET preferredLanguage = 'ko' WHERE preferredLanguage = 'ru';
