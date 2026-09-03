-- Next phase: business profiles, verification, services, hours, and bookings

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  address TEXT NOT NULL,
  location TEXT NOT NULL,
  phone TEXT,
  website_url TEXT,
  latitude REAL,
  longitude REAL,
  opening_hours TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'removed')),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  is_shadow_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_shadow_hidden IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS business_services (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 15 AND 480),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS business_verification_requests (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  evidence TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT REFERENCES "user" (id) ON DELETE SET NULL,
  reviewed_at TEXT,
  resolution_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS business_bookings (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  service_id TEXT REFERENCES business_services (id) ON DELETE SET NULL,
  requester_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  start_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 15 AND 480),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'confirmed', 'declined', 'cancelled', 'completed')),
  owner_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_verification_pending
  ON business_verification_requests (business_id)
  WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_booking_open_slot
  ON business_bookings (business_id, requester_id, start_at)
  WHERE status IN ('requested', 'confirmed');
CREATE INDEX IF NOT EXISTS idx_businesses_discovery
  ON businesses (status, verification_status, location, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_businesses_owner
  ON businesses (owner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_businesses_category
  ON businesses (category, status, verification_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_services_business
  ON business_services (business_id, is_active, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_business_verification_queue
  ON business_verification_requests (status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_business_verification_business
  ON business_verification_requests (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_bookings_business
  ON business_bookings (business_id, status, start_at ASC);
CREATE INDEX IF NOT EXISTS idx_business_bookings_requester
  ON business_bookings (requester_id, status, start_at DESC);

INSERT OR IGNORE INTO site_settings (key, value) VALUES
  ('max_businesses_per_hour', '3'),
  ('max_businesses_burst_per_min', '1'),
  ('max_business_verification_per_hour', '3'),
  ('max_business_verification_burst_per_min', '1'),
  ('max_booking_requests_per_hour', '10'),
  ('max_booking_requests_burst_per_min', '3');
