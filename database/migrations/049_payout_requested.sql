-- 049_payout_requested.sql
-- Lets a provider (guide/company) request payment for an earned-but-unsettled
-- invoice. Stamped when they press "Request payment" on their dashboard.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "payoutRequestedAt" timestamptz;

CREATE INDEX IF NOT EXISTS idx_bookings_payout_requested
  ON bookings ("payoutRequestedAt")
  WHERE "payoutRequestedAt" IS NOT NULL;

NOTIFY pgrst, 'reload schema';
