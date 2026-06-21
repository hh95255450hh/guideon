-- ============================================================================
-- 043_booking_capacity_indexes.sql
-- ----------------------------------------------------------------------------
-- Fix: the old active-booking unique indexes were too coarse and silently
-- broke real features.
--
--   uniq_active_booking_per_guide_date = UNIQUE ("guideId","tourDate")
--   → only ONE active booking per provider per DATE, which blocked:
--     • company concurrency (a company runs many tours at once)
--     • group package departures (many tourists join one date)
--     • a guide offering morning + afternoon (or several time slots) per day
--
-- New model: the unique constraint is a RACE backstop for INDIVIDUAL GUIDES
-- only (capacity = 1). Companies and packages are governed by application-level
-- capacity / seat checks in bookingService, so they are excluded here.
--
-- Requires the new bookings."providerType" column (added + backfilled below).
-- Safe to re-run.
-- ============================================================================

-- 1) Discriminator so the partial indexes can target solo-guide rows only.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "providerType" TEXT;

-- Backfill existing rows from the provider's user record.
UPDATE bookings b
SET "providerType" = u."userType"
FROM users u
WHERE u.id = b."guideId" AND b."providerType" IS NULL;

-- 2) Drop the over-broad indexes.
DROP INDEX IF EXISTS uniq_active_booking_per_guide_date;
DROP INDEX IF EXISTS uniq_active_booking_per_guide_slot;

-- 3a) Solo-guide DAY-RATE bookings: one active booking per (guide, date, slot).
--     Scoped to individual guides, non-package, non-time-slot rows. Including
--     "tourTime" lets a guide hold morning AND afternoon on the same day.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_guide_dayrate
  ON bookings ("guideId", "tourDate", "tourTime")
  WHERE status IN ('pending', 'quoted', 'confirmed', 'completed')
    AND "startTime" IS NULL
    AND "packageId" IS NULL
    AND "providerType" = 'guide';

-- 3b) Solo-guide TIME-SLOT bookings: one active booking per (guide, date, start).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_guide_slot
  ON bookings ("guideId", "tourDate", "startTime")
  WHERE status IN ('pending', 'quoted', 'confirmed', 'completed')
    AND "startTime" IS NOT NULL
    AND "providerType" = 'guide';

-- Companies + packages: intentionally NO unique index. Their capacity is
-- enforced in bookingService (maxConcurrentTours / max_group_size seats).
