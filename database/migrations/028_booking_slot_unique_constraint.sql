-- ============================================================================
-- 028_booking_slot_unique_constraint.sql
-- ----------------------------------------------------------------------------
-- Prevent race condition: two tourists booking the same time slot for the
-- same guide on the same date simultaneously.
--
-- The existing index (002) covers day-rate bookings: UNIQUE (guideId, tourDate).
-- This index covers time-slot bookings: UNIQUE (guideId, tourDate, startTime).
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_booking_per_guide_slot
ON bookings ("guideId", "tourDate", "startTime")
WHERE status IN ('pending', 'confirmed', 'completed')
  AND "startTime" IS NOT NULL;
