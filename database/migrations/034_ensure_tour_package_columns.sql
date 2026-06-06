-- ============================================================================
-- 034_ensure_tour_package_columns.sql
-- ----------------------------------------------------------------------------
-- A company tried to add a tour package and got "Server error. Please try
-- again." because the tour_packages table was missing one or more columns
-- the app writes (guideId, categories, duration_hours/minutes, offers,
-- variants, addons, availableDates, highlights). Consolidates every
-- per-package column the controller touches into one idempotent migration.
-- ============================================================================

-- Provider linking (added when the schema supported guides as providers)
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "guideId" text;

-- Multi-category support (migration 014)
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS categories jsonb DEFAULT '[]'::jsonb;

-- Hours/minutes duration (migration 013) — relax legacy days NOT NULL/CHECK
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS duration_hours   int DEFAULT 0;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS duration_minutes int DEFAULT 0;
ALTER TABLE tour_packages ALTER COLUMN duration_days DROP NOT NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'tour_packages'
      AND constraint_name = 'tour_packages_duration_days_check'
  ) THEN
    EXECUTE 'ALTER TABLE tour_packages DROP CONSTRAINT tour_packages_duration_days_check';
  END IF;
END $$;

-- Offers (migration 008)
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "discountPercent" int DEFAULT 0;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "offerLabel" text;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "offerUntil" timestamptz;

-- Variants & add-ons (migration 009)
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT '[]'::jsonb;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS addons   jsonb DEFAULT '[]'::jsonb;

-- Newer fields
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "availableDates" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS highlights       jsonb DEFAULT '[]'::jsonb;

-- Defensive: make sure these core jsonb fields are present (some older
-- deployments dropped them when columns were renamed).
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS includes  jsonb DEFAULT '[]'::jsonb;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS excludes  jsonb DEFAULT '[]'::jsonb;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS itinerary jsonb DEFAULT '[]'::jsonb;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS languages jsonb DEFAULT '[]'::jsonb;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS images    jsonb DEFAULT '[]'::jsonb;

-- Stats / publication flags
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "isPublished"  boolean DEFAULT false;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "isFeatured"   boolean DEFAULT false;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS rating         numeric(3,2) DEFAULT 0;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "totalReviews" int DEFAULT 0;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "totalBookings" int DEFAULT 0;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "updatedAt"    timestamptz DEFAULT now();

-- ─── Company "packages" field on users ──────────────────────────────────
-- The company dashboard stores its tour packages inline on the user record
-- (a small jsonb array of {name, price, duration, destination, includes,
-- description}). The PUT /api/auth/profile call was failing with
-- "Server error" because this column didn't exist.
ALTER TABLE users ADD COLUMN IF NOT EXISTS packages jsonb DEFAULT '[]'::jsonb;
