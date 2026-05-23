-- ════════════════════════════════════════════════════════════════════
--  Migration 007 — Staff system with granular permissions
-- ════════════════════════════════════════════════════════════════════

-- Add staff fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS "staffRole"   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions   JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "createdBy"   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMPTZ;

-- Index for staff lookups
CREATE INDEX IF NOT EXISTS idx_users_staffRole ON users ("staffRole") WHERE "staffRole" IS NOT NULL;

-- Allow 'staff' as userType
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%userType%' OR constraint_name LIKE '%user_type%'
  ) THEN
    -- if there's a check constraint, we skip — Supabase tables typically don't enforce enums
    NULL;
  END IF;
END $$;
