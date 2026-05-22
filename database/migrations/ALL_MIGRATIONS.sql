-- ════════════════════════════════════════════════════════════════════
--  GUIDEON — ALL MIGRATIONS COMBINED
--  Run this ENTIRE file ONCE in Supabase SQL Editor.
--  Safe to re-run (uses IF NOT EXISTS everywhere).
-- ════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════
--  001 — FCM TOKEN
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;


-- ════════════════════════════════════════════════════════════════════
--  002 — BOOKING UNIQUE CONSTRAINT (prevent double-booking)
-- ════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_booking_per_guide_date
ON bookings ("guideId", "tourDate")
WHERE status IN ('pending', 'confirmed', 'completed');


-- ════════════════════════════════════════════════════════════════════
--  003 — PERFORMANCE INDEXES
-- ════════════════════════════════════════════════════════════════════

-- USERS
CREATE INDEX IF NOT EXISTS idx_users_email           ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_userType        ON users ("userType");
CREATE INDEX IF NOT EXISTS idx_users_isVerified      ON users ("isVerified") WHERE "isVerified" = true;
CREATE INDEX IF NOT EXISTS idx_users_isSuspended     ON users ("isSuspended") WHERE "isSuspended" = false;

-- Email verification & password reset tokens (added by F2 features)
ALTER TABLE users ADD COLUMN IF NOT EXISTS "emailVerified"      BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "emailVerifyToken"   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "emailVerifyExpires" TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "resetPasswordToken" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "resetPasswordExpires" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_verifyToken     ON users ("emailVerifyToken") WHERE "emailVerifyToken" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_resetToken      ON users ("resetPasswordToken") WHERE "resetPasswordToken" IS NOT NULL;

-- BOOKINGS
CREATE INDEX IF NOT EXISTS idx_bookings_touristId    ON bookings ("touristId");
CREATE INDEX IF NOT EXISTS idx_bookings_guideId      ON bookings ("guideId");
CREATE INDEX IF NOT EXISTS idx_bookings_status       ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_createdAt    ON bookings ("createdAt" DESC);

-- Payment tracking columns
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "isPaid"  BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "paidAt"  TIMESTAMPTZ;

-- REVIEWS
CREATE INDEX IF NOT EXISTS idx_reviews_guideId       ON reviews ("guideId");
CREATE INDEX IF NOT EXISTS idx_reviews_bookingId     ON reviews ("bookingId");
CREATE INDEX IF NOT EXISTS idx_reviews_createdAt     ON reviews ("createdAt" DESC);

-- MESSAGES (table may not exist on older deployments — guard with check)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'messages') THEN
    CREATE INDEX IF NOT EXISTS idx_messages_fromId    ON messages ("fromId");
    CREATE INDEX IF NOT EXISTS idx_messages_toId      ON messages ("toId");
    CREATE INDEX IF NOT EXISTS idx_messages_unread    ON messages ("toId", "isRead") WHERE "isRead" = false;
    CREATE INDEX IF NOT EXISTS idx_messages_createdAt ON messages ("createdAt" DESC);
  END IF;
END $$;

-- TRIP_REQUESTS
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'trip_requests') THEN
    CREATE INDEX IF NOT EXISTS idx_trip_requests_touristId ON trip_requests ("touristId");
    CREATE INDEX IF NOT EXISTS idx_trip_requests_status    ON trip_requests (status);
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════════
--  004 — TOUR PACKAGES SYSTEM
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tour_packages (
  id              TEXT PRIMARY KEY,
  "providerId"    TEXT NOT NULL,
  "providerType"  TEXT NOT NULL CHECK ("providerType" IN ('guide', 'company')),
  title           TEXT NOT NULL,
  description     TEXT,
  destination     TEXT,
  region          TEXT,
  category        TEXT,
  difficulty      TEXT DEFAULT 'moderate' CHECK (difficulty IN ('easy', 'moderate', 'hard')),
  duration_days   INTEGER NOT NULL DEFAULT 1 CHECK (duration_days >= 1),
  max_group_size  INTEGER NOT NULL DEFAULT 10 CHECK (max_group_size >= 1),
  price_adult     NUMERIC(10, 2) NOT NULL CHECK (price_adult >= 0),
  price_child     NUMERIC(10, 2) DEFAULT 0 CHECK (price_child >= 0),
  currency        TEXT DEFAULT 'OMR',
  includes        JSONB DEFAULT '[]'::jsonb,
  excludes        JSONB DEFAULT '[]'::jsonb,
  itinerary       JSONB DEFAULT '[]'::jsonb,
  meeting_point   TEXT,
  languages       JSONB DEFAULT '[]'::jsonb,
  images          JSONB DEFAULT '[]'::jsonb,
  cover_image     TEXT,
  cancellation_policy TEXT DEFAULT 'flexible' CHECK (cancellation_policy IN ('flexible', 'moderate', 'strict')),
  "isPublished"   BOOLEAN DEFAULT false,
  "isFeatured"    BOOLEAN DEFAULT false,
  rating          NUMERIC(3, 2) DEFAULT 0,
  "totalReviews"  INTEGER DEFAULT 0,
  "totalBookings" INTEGER DEFAULT 0,
  "createdAt"     TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_packages_provider    ON tour_packages ("providerId");
CREATE INDEX IF NOT EXISTS idx_tour_packages_published   ON tour_packages ("isPublished") WHERE "isPublished" = true;
CREATE INDEX IF NOT EXISTS idx_tour_packages_featured    ON tour_packages ("isFeatured") WHERE "isFeatured" = true;
CREATE INDEX IF NOT EXISTS idx_tour_packages_category    ON tour_packages (category);
CREATE INDEX IF NOT EXISTS idx_tour_packages_destination ON tour_packages (destination);

CREATE TABLE IF NOT EXISTS package_availability (
  id               TEXT PRIMARY KEY,
  "packageId"      TEXT NOT NULL REFERENCES tour_packages(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  "availableSpots" INTEGER NOT NULL CHECK ("availableSpots" >= 0),
  "createdAt"      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE ("packageId", date)
);

CREATE INDEX IF NOT EXISTS idx_package_avail_package ON package_availability ("packageId");
CREATE INDEX IF NOT EXISTS idx_package_avail_date    ON package_availability (date);

-- Extend bookings to support package bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "packageId"  TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "adultCount" INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "childCount" INTEGER DEFAULT 0;


-- ════════════════════════════════════════════════════════════════════
--  005 — REVIEWS WITH PHOTOS + Q&A + NEWSLETTER + SHARED WISHLISTS
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "helpfulCount" INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS guide_questions (
  id           TEXT PRIMARY KEY,
  "guideId"    TEXT NOT NULL,
  "askerId"    TEXT NOT NULL,
  "askerName"  TEXT,
  question     TEXT NOT NULL,
  answer       TEXT,
  "answeredAt" TIMESTAMPTZ,
  "isPublic"   BOOLEAN DEFAULT true,
  "createdAt"  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_questions_guide  ON guide_questions ("guideId");
CREATE INDEX IF NOT EXISTS idx_guide_questions_public ON guide_questions ("isPublic", "guideId") WHERE "isPublic" = true;

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  language    TEXT DEFAULT 'en',
  source      TEXT,
  "isActive"  BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers (email);

CREATE TABLE IF NOT EXISTS shared_wishlists (
  id          TEXT PRIMARY KEY,
  "ownerId"   TEXT NOT NULL,
  "ownerName" TEXT,
  "guideIds"  JSONB DEFAULT '[]'::jsonb,
  title       TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);


-- ════════════════════════════════════════════════════════════════════
--  RLS POLICIES (Supabase) — make new tables readable via anon key
--  Adjust to your security model. These are permissive defaults.
-- ════════════════════════════════════════════════════════════════════

-- Tour packages: public read, authenticated write (handled in app)
ALTER TABLE tour_packages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_availability   ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_wishlists       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tour_packages_all" ON tour_packages;
CREATE POLICY "tour_packages_all" ON tour_packages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "package_availability_all" ON package_availability;
CREATE POLICY "package_availability_all" ON package_availability FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "guide_questions_all" ON guide_questions;
CREATE POLICY "guide_questions_all" ON guide_questions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "newsletter_all" ON newsletter_subscribers;
CREATE POLICY "newsletter_all" ON newsletter_subscribers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "shared_wishlists_all" ON shared_wishlists;
CREATE POLICY "shared_wishlists_all" ON shared_wishlists FOR ALL USING (true) WITH CHECK (true);


-- ════════════════════════════════════════════════════════════════════
--  DONE
-- ════════════════════════════════════════════════════════════════════
