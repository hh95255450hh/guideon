-- ══════════════════════════════════════════════════════════
--  Guideon — Supabase Migration
--  Run this in: Supabase Dashboard → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════

-- Users
CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,
  "fullName"         TEXT NOT NULL DEFAULT '',
  email              TEXT UNIQUE NOT NULL,
  password           TEXT NOT NULL,
  phone              TEXT DEFAULT '',
  "userType"         TEXT NOT NULL DEFAULT 'tourist',
  nationality        TEXT DEFAULT '',
  "preferredLanguage" TEXT DEFAULT 'English',
  "licenceNumber"    TEXT DEFAULT '',
  languages          JSONB DEFAULT '[]'::jsonb,
  specialisations    JSONB DEFAULT '[]'::jsonb,
  destinations       JSONB DEFAULT '[]'::jsonb,
  rating             NUMERIC(4,2) DEFAULT 0,
  "totalReviews"     INTEGER DEFAULT 0,
  "pricePerDay"      NUMERIC(10,2) DEFAULT 0,
  bio                TEXT DEFAULT '',
  "isVerified"       BOOLEAN DEFAULT FALSE,
  availability       JSONB DEFAULT '[]'::jsonb,
  photo              TEXT DEFAULT '',
  "isSuspended"      BOOLEAN DEFAULT FALSE,
  "createdAt"        TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id                TEXT PRIMARY KEY,
  "touristId"       TEXT NOT NULL,
  "guideId"         TEXT NOT NULL,
  "tourDate"        TEXT NOT NULL,
  duration          TEXT NOT NULL DEFAULT 'full',
  destination       TEXT NOT NULL,
  participants      INTEGER DEFAULT 1,
  "totalAmount"     NUMERIC(10,2) DEFAULT 0,
  status            TEXT DEFAULT 'pending',
  "specialRequests" TEXT DEFAULT '',
  "createdAt"       TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  "reviewId"    TEXT PRIMARY KEY,
  "bookingId"   TEXT NOT NULL,
  "touristId"   TEXT NOT NULL,
  "guideId"     TEXT NOT NULL,
  rating        INTEGER NOT NULL DEFAULT 5,
  comment       TEXT DEFAULT '',
  "touristName" TEXT DEFAULT '',
  "createdAt"   TIMESTAMPTZ DEFAULT NOW()
);

-- Trip Requests
CREATE TABLE IF NOT EXISTS trip_requests (
  id              TEXT PRIMARY KEY,
  "touristId"     TEXT NOT NULL,
  "touristName"   TEXT DEFAULT '',
  "touristEmail"  TEXT DEFAULT '',
  destination     TEXT NOT NULL,
  "startDate"     TEXT NOT NULL,
  "endDate"       TEXT DEFAULT '',
  "groupSize"     INTEGER DEFAULT 1,
  language        TEXT DEFAULT '',
  specialisation  TEXT DEFAULT '',
  budget          TEXT DEFAULT '',
  notes           TEXT DEFAULT '',
  status          TEXT DEFAULT 'open',
  "createdAt"     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Disable RLS (auth handled in Node.js sessions) ──
ALTER TABLE users         DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings      DISABLE ROW LEVEL SECURITY;
ALTER TABLE reviews       DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_requests DISABLE ROW LEVEL SECURITY;

-- ── Grant full access to anon role ──
GRANT SELECT, INSERT, UPDATE, DELETE ON users         TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON bookings      TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON reviews       TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON trip_requests TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON users         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bookings      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON reviews       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON trip_requests TO authenticated;
