-- Tour packages — full tour products offered by companies or guides.
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

CREATE INDEX IF NOT EXISTS idx_tour_packages_provider  ON tour_packages ("providerId");
CREATE INDEX IF NOT EXISTS idx_tour_packages_published ON tour_packages ("isPublished") WHERE "isPublished" = true;
CREATE INDEX IF NOT EXISTS idx_tour_packages_featured  ON tour_packages ("isFeatured") WHERE "isFeatured" = true;
CREATE INDEX IF NOT EXISTS idx_tour_packages_category  ON tour_packages (category);
CREATE INDEX IF NOT EXISTS idx_tour_packages_destination ON tour_packages (destination);

-- Tour package availability (specific dates)
CREATE TABLE IF NOT EXISTS package_availability (
  id              TEXT PRIMARY KEY,
  "packageId"     TEXT NOT NULL REFERENCES tour_packages(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  "availableSpots" INTEGER NOT NULL CHECK ("availableSpots" >= 0),
  "createdAt"     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE ("packageId", date)
);

CREATE INDEX IF NOT EXISTS idx_package_avail_package ON package_availability ("packageId");
CREATE INDEX IF NOT EXISTS idx_package_avail_date    ON package_availability (date);

-- Extend bookings to support package bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "packageId"     TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "adultCount"    INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "childCount"    INTEGER DEFAULT 0;
