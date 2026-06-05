-- ============================================================================
-- 030_booking_quote.sql
-- ----------------------------------------------------------------------------
-- Custom trip request → guide price offer → tourist accepts.
--
-- Adds quotedAmount (the price the guide proposes) and folds the new 'quoted'
-- status into the active-booking unique constraints so a quoted slot is held.
-- ============================================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "quotedAmount" numeric(10,2);

-- Rebuild the active-booking unique indexes to also reserve quoted slots.
DROP INDEX IF EXISTS uniq_active_booking_per_guide_date;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_booking_per_guide_date
  ON bookings ("guideId", "tourDate")
  WHERE status IN ('pending', 'quoted', 'confirmed', 'completed');

DROP INDEX IF EXISTS uniq_active_booking_per_guide_slot;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_booking_per_guide_slot
  ON bookings ("guideId", "tourDate", "startTime")
  WHERE status IN ('pending', 'quoted', 'confirmed', 'completed')
    AND "startTime" IS NOT NULL;
