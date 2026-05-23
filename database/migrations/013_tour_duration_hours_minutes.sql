-- Add hours and minutes to tour duration alongside existing duration_days.
-- A tour duration is now: duration_days + duration_hours + duration_minutes.
ALTER TABLE tour_packages
  ADD COLUMN IF NOT EXISTS duration_hours   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 0;

-- Sanity range constraints (0-23 hours, 0-59 minutes — anything else makes no sense).
DO $$ BEGIN
  ALTER TABLE tour_packages
    ADD CONSTRAINT check_duration_hours_range   CHECK (duration_hours BETWEEN 0 AND 23);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE tour_packages
    ADD CONSTRAINT check_duration_minutes_range CHECK (duration_minutes BETWEEN 0 AND 59);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
