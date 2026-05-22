-- ════════════════════════════════════════════════════════════════════
--  Migration 006 — Admin features (audit log + cancellation reasons)
-- ════════════════════════════════════════════════════════════════════

-- AUDIT LOG: tracks every admin action
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          TEXT PRIMARY KEY,
  "adminId"   TEXT NOT NULL,
  "adminName" TEXT,
  action      TEXT NOT NULL,
  "targetType" TEXT,
  "targetId"  TEXT,
  details     JSONB DEFAULT '{}'::jsonb,
  ip          TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin   ON admin_audit_log ("adminId");
CREATE INDEX IF NOT EXISTS idx_audit_target  ON admin_audit_log ("targetType", "targetId");
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON admin_audit_log (action);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_all" ON admin_audit_log;
CREATE POLICY "audit_all" ON admin_audit_log FOR ALL USING (true) WITH CHECK (true);

-- Add cancellation reason to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;
