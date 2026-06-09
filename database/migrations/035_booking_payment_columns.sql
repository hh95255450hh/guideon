-- 035_booking_payment_columns.sql
-- Adds the columns the Thawani payment flow needs on the bookings table.
-- Safe to run multiple times.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "isPaid"            boolean      DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "paidAt"            timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "paymentSessionId"  text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "paymentRef"        text;

-- Helpful index for "unpaid confirmed bookings" lookups.
CREATE INDEX IF NOT EXISTS idx_bookings_ispaid ON bookings ("isPaid");
