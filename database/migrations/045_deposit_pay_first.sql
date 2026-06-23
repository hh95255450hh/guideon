-- ============================================================================
-- 045_deposit_pay_first.sql
-- ----------------------------------------------------------------------------
-- Pay-first booking flow: a priced booking is created as 'awaiting_payment'
-- and is NOT sent to the provider until the tourist pays a deposit. The tourist
-- chooses a deposit percentage (25 / 50 / 100). On payment the booking flips to
-- 'pending' and the provider is notified.
--
-- Status lifecycle:
--   awaiting_payment → (deposit paid) → pending → confirmed → in_progress → completed
--
-- The active-booking unique indexes only include
-- pending/quoted/confirmed/completed, so 'awaiting_payment' rows do NOT reserve
-- the slot until the deposit is actually paid (good — abandoned checkouts free
-- the slot). No index change needed.
-- Safe to re-run.
-- ============================================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "depositPercent" INTEGER;       -- 25 | 50 | 100
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "depositAmount"  NUMERIC(10,3);  -- amount paid up front
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "balanceAmount"  NUMERIC(10,3);  -- remaining after deposit
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "depositPaidAt"  TIMESTAMPTZ;    -- when the deposit was paid
