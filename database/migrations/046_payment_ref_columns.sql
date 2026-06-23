-- ============================================================================
-- 046_payment_ref_columns.sql
-- ----------------------------------------------------------------------------
-- paymentSessionId / paymentRef were referenced by the payment code (and listed
-- in OPTIONAL_PAY_COLS) but never actually created. Because they were missing,
-- a settle-update that set paymentRef hit a "column does not exist" error and
-- the resilient-write helper stripped the WHOLE optional set — including isPaid
-- and paidAt — so paid bookings ended up with isPaid=false. Create the columns.
-- Safe to re-run.
-- ============================================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "paymentSessionId" TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "paymentRef"       TEXT;
