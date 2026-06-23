-- Link auto-generated guide payout invoices to their booking (for idempotency
-- and traceability), and record the gross/commission/net split.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "bookingId"   TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS kind          TEXT;     -- 'payout' (guide earnings) | 'manual'
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gross         NUMERIC(10,3);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS commission    NUMERIC(10,3);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS net           NUMERIC(10,3);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "paidOutAt"   TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_invoices_booking   ON invoices ("bookingId");
CREATE INDEX IF NOT EXISTS idx_invoices_recipient ON invoices ("recipientId");
