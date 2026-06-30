-- 051_guest_bookings.sql
-- Guest (no-account) checkout: a visitor can book a tour with just their
-- name + email/phone. touristId stays NULL; we store the contact here.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "guestName"  text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "guestEmail" text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "guestPhone" text;

CREATE INDEX IF NOT EXISTS idx_bookings_guest_email
  ON bookings ("guestEmail") WHERE "guestEmail" IS NOT NULL;

NOTIFY pgrst, 'reload schema';
