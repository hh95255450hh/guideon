-- 052_payment_idempotency.sql
-- Prevent a payment webhook from being processed twice by adding a unique
-- index on paymentRef. A partial index (WHERE paymentRef IS NOT NULL) means
-- un-paid bookings (NULL ref) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_payment_ref_unique
  ON bookings ("paymentRef")
  WHERE "paymentRef" IS NOT NULL;

-- Also index paidAt for fast "find unpaid bookings older than N days" queries.
CREATE INDEX IF NOT EXISTS idx_bookings_paid_at
  ON bookings ("paidAt")
  WHERE "paidAt" IS NOT NULL;

NOTIFY pgrst, 'reload schema';
