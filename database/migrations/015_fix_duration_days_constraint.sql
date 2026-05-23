-- Old constraint required duration_days >= 1.
-- Now that we have separate hours/minutes, a tour can be (0 days · 4 hours).
-- Drop the old constraint and replace it with one that allows 0+.

ALTER TABLE tour_packages
  DROP CONSTRAINT IF EXISTS tour_packages_duration_days_check;

ALTER TABLE tour_packages
  ADD CONSTRAINT tour_packages_duration_days_check
  CHECK (duration_days >= 0);

-- Safety: also make sure at least ONE duration unit is set
-- (no tour can be 0 days + 0 hours + 0 minutes).
DO $$ BEGIN
  ALTER TABLE tour_packages
    ADD CONSTRAINT tour_packages_duration_nonzero
    CHECK (duration_days > 0 OR duration_hours > 0 OR duration_minutes > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
