-- 053_referral_system.sql
-- Simple referral system: every user gets a unique 6-char referralCode.
-- When a new user signs up with ?ref=CODE the referredBy column records
-- the referrer's userId. The booking service applies a 5% discount
-- (capped at 5 OMR) to the new user's FIRST booking automatically.

ALTER TABLE users ADD COLUMN IF NOT EXISTS "referralCode"    text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "referredBy"       text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "referralDiscountUsed" boolean DEFAULT false;

-- Unique index so no two users share a code.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code
  ON users ("referralCode") WHERE "referralCode" IS NOT NULL;

-- Fast lookup: "find the user who owns code XYZ"
CREATE INDEX IF NOT EXISTS idx_users_referred_by
  ON users ("referredBy") WHERE "referredBy" IS NOT NULL;

-- Record the discount applied on the booking so finance/admin can audit.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "referralDiscount" numeric(10,3) DEFAULT 0;

NOTIFY pgrst, 'reload schema';
