-- 021_booking_lifecycle_columns.sql
-- Adds the booking lifecycle + package columns the app writes but were missing
-- from the bookings table. Without these, guides could not start/complete trips
-- and package bookings with add-ons failed to insert.
--
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "startedAt"   timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "completedAt" timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "variantName" text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "addons"      jsonb DEFAULT '[]'::jsonb;
