-- Better Auth passkey plugin storage.

CREATE TABLE IF NOT EXISTS passkey (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  publicKey TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  credentialID TEXT NOT NULL,
  counter INTEGER NOT NULL,
  deviceType TEXT NOT NULL,
  backedUp INTEGER NOT NULL CHECK (backedUp IN (0, 1)),
  transports TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  aaguid TEXT
);

CREATE INDEX IF NOT EXISTS idx_passkey_user ON passkey (userId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_passkey_credential ON passkey (credentialID);
