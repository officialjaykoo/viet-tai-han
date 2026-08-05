-- Align Better Auth tables with default camelCase column names
-- (Better Auth was inserting emailVerified while schema had email_verified)

PRAGMA foreign_keys = OFF;

CREATE TABLE user_auth (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  emailVerified INTEGER NOT NULL DEFAULT 0 CHECK (emailVerified IN (0, 1)),
  image TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  username TEXT UNIQUE COLLATE NOCASE,
  displayUsername TEXT,
  karma INTEGER NOT NULL DEFAULT 0,
  postKarma INTEGER NOT NULL DEFAULT 0,
  commentKarma INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned', 'shadowbanned')),
  bio TEXT
);

INSERT INTO user_auth (
  id, name, email, emailVerified, image, createdAt, updatedAt,
  username, displayUsername, karma, postKarma, commentKarma, role, status, bio
)
SELECT
  id,
  name,
  email,
  email_verified,
  image,
  created_at,
  updated_at,
  username,
  display_username,
  karma,
  post_karma,
  comment_karma,
  role,
  status,
  bio
FROM "user";

CREATE TABLE session_auth (
  id TEXT PRIMARY KEY NOT NULL,
  expiresAt TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  ipAddress TEXT,
  userAgent TEXT,
  userId TEXT NOT NULL REFERENCES user_auth (id) ON DELETE CASCADE
);

INSERT INTO session_auth (
  id, expiresAt, token, createdAt, updatedAt, ipAddress, userAgent, userId
)
SELECT
  id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id
FROM session;

CREATE TABLE account_auth (
  id TEXT PRIMARY KEY NOT NULL,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES user_auth (id) ON DELETE CASCADE,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  accessTokenExpiresAt TEXT,
  refreshTokenExpiresAt TEXT,
  scope TEXT,
  password TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO account_auth (
  id, accountId, providerId, userId, accessToken, refreshToken, idToken,
  accessTokenExpiresAt, refreshTokenExpiresAt, scope, password, createdAt, updatedAt
)
SELECT
  id, account_id, provider_id, user_id, access_token, refresh_token, id_token,
  access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at
FROM account;

CREATE TABLE verification_auth (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO verification_auth (id, identifier, value, expiresAt, createdAt, updatedAt)
SELECT id, identifier, value, expires_at, created_at, updated_at
FROM verification;

DROP TABLE verification;
DROP TABLE account;
DROP TABLE session;
DROP TABLE "user";

ALTER TABLE user_auth RENAME TO "user";
ALTER TABLE session_auth RENAME TO session;
ALTER TABLE account_auth RENAME TO account;
ALTER TABLE verification_auth RENAME TO verification;

CREATE INDEX IF NOT EXISTS idx_session_user ON session (userId);
CREATE INDEX IF NOT EXISTS idx_account_user ON account (userId);
CREATE INDEX IF NOT EXISTS idx_user_username ON "user" (username);
CREATE INDEX IF NOT EXISTS idx_user_status ON "user" (status);

PRAGMA foreign_keys = ON;
