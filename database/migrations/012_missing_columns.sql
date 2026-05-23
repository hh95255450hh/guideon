-- Add columns referenced by the app but missing from the DB.
-- Safe to run multiple times (IF NOT EXISTS).

-- ─── Guide Ministry licence flag (causing "Server error" on guide signup) ─────
ALTER TABLE users ADD COLUMN IF NOT EXISTS "isMinistryLicensed" boolean NOT NULL DEFAULT false;

-- ─── 2FA columns (from migration 011, in case it wasn't run) ──────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS "twoFactorSecret"      text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "twoFactorEnabled"     boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "twoFactorBackupCodes" jsonb;

-- ─── Staff system columns (admin granular permissions) ────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS "staffRole"   text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "permissions" jsonb;

-- ─── Profile updatedAt (used by SupabaseDB.update) ────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz;

-- Index for licensed guides (search filter)
CREATE INDEX IF NOT EXISTS idx_users_ministry_licensed
  ON users("isMinistryLicensed") WHERE "userType" = 'guide';
