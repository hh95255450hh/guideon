-- ════════════════════════════════════════════════════════════════════
--  GUIDEON — run this whole block once in Supabase → SQL Editor → Run.
--  Combines migrations 037 + 038 + 039. Safe to re-run (idempotent).
--  Enables: financial expenses, provider payouts, per-provider commission,
--  VAT, and the event-teams vertical (team registration + events).
-- ════════════════════════════════════════════════════════════════════

-- ── 037: Financial expenses (salaries / discounts / costs) ──────────────
CREATE TABLE IF NOT EXISTS finance_expenses (
  id              TEXT PRIMARY KEY,
  category        TEXT NOT NULL,
  title           TEXT NOT NULL,
  amount          NUMERIC(12,3) NOT NULL,
  currency        TEXT DEFAULT 'OMR',
  "spentAt"       DATE NOT NULL,
  recurring       BOOLEAN DEFAULT FALSE,
  "payee"         TEXT,
  "relatedUserId" TEXT,
  note            TEXT,
  "createdBy"     TEXT,
  "createdAt"     TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fexp_category  ON finance_expenses (category);
CREATE INDEX IF NOT EXISTS idx_fexp_spent     ON finance_expenses ("spentAt" DESC);
CREATE INDEX IF NOT EXISTS idx_fexp_recurring ON finance_expenses (recurring);
ALTER TABLE finance_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fexp_all" ON finance_expenses;
CREATE POLICY "fexp_all" ON finance_expenses FOR ALL USING (true) WITH CHECK (true);

-- ── 038: Provider payouts + per-user commission override ────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "paidOutAt" TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "payoutRef" TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "payoutBy"  TEXT;
CREATE INDEX IF NOT EXISTS idx_bookings_paidout ON bookings ("paidOutAt");
ALTER TABLE users ADD COLUMN IF NOT EXISTS "commissionRate" NUMERIC(5,4);

-- ── 039: Event teams + events ──────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS "teamName"        TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "teamCategory"    TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "teamDescription" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "teamGovernorate" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "membersCount"    INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "foundedYear"     INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "teamSocials"     JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS team_events (
  id            TEXT PRIMARY KEY,
  "teamId"      TEXT NOT NULL,
  title         TEXT NOT NULL,
  "titleAr"     TEXT,
  category      TEXT,
  description   TEXT,
  governorate   TEXT,
  location      TEXT,
  "eventDate"   DATE,
  "startTime"   TEXT,
  "endTime"     TEXT,
  "ticketPrice" NUMERIC(10,3) DEFAULT 0,
  capacity      INTEGER,
  "coverImage"  TEXT,
  gallery       JSONB DEFAULT '[]'::jsonb,
  "isPublished" BOOLEAN DEFAULT FALSE,
  "createdAt"   TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_team_events_team      ON team_events ("teamId");
CREATE INDEX IF NOT EXISTS idx_team_events_published ON team_events ("isPublished");
CREATE INDEX IF NOT EXISTS idx_team_events_date      ON team_events ("eventDate");
ALTER TABLE team_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_events_all" ON team_events;
CREATE POLICY "team_events_all" ON team_events FOR ALL USING (true) WITH CHECK (true);

-- ── Commission defaults (guide / company / team / VAT) ─────────────────
INSERT INTO site_settings (key, value)
VALUES ('commission', '{"guide": 0.10, "company": 0.15, "team": 0.10, "vat": 0, "vatNumber": ""}'::jsonb)
ON CONFLICT (key) DO UPDATE
SET value = site_settings.value
  || CASE WHEN NOT (site_settings.value ? 'team') THEN '{"team": 0.10}'::jsonb ELSE '{}'::jsonb END
  || CASE WHEN NOT (site_settings.value ? 'vat')  THEN '{"vat": 0, "vatNumber": ""}'::jsonb ELSE '{}'::jsonb END;

-- ✅ Done. You should see "Success. No rows returned" (or a few UPDATE counts).
