-- ════════════════════════════════════════════════════════════════════
--  Migration 038 — Provider payouts + per-user commission override
-- ════════════════════════════════════════════════════════════════════
--  Lets the admin mark a provider's earnings as "paid out" and lets a
--  specific guide/company carry a negotiated commission rate that
--  overrides the type-level default.
-- ════════════════════════════════════════════════════════════════════

-- When the platform transfers a booking's net payout to the provider.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "paidOutAt" TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "payoutRef" TEXT;   -- bank/transfer reference
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "payoutBy"  TEXT;   -- admin id who settled it

CREATE INDEX IF NOT EXISTS idx_bookings_paidout ON bookings ("paidOutAt");

-- Optional per-provider commission override (fraction, e.g. 0.12 = 12%).
-- NULL = use the type-level default from site_settings 'commission'.
ALTER TABLE users ADD COLUMN IF NOT EXISTS "commissionRate" NUMERIC(5,4);

-- Default commission rates the admin can edit from the dashboard.
-- Stored in the existing site_settings key/value store.
INSERT INTO site_settings (key, value)
VALUES ('commission', '{"guide": 0.10, "company": 0.15, "vat": 0, "vatNumber": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;
