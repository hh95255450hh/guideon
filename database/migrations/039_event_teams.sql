-- ════════════════════════════════════════════════════════════════════
--  Migration 039 — Event teams vertical
-- ════════════════════════════════════════════════════════════════════
--  A new provider type: event teams/crews that run events & activities
--  across Oman (cultural shows, sports, adventure, music, etc.).
--  Teams reuse the users table (like companies) plus a team_events table.
-- ════════════════════════════════════════════════════════════════════

-- Team profile fields on the shared users table (userType = 'team').
ALTER TABLE users ADD COLUMN IF NOT EXISTS "teamName"        TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "teamCategory"    TEXT;      -- e.g. cultural / sports / music / adventure
ALTER TABLE users ADD COLUMN IF NOT EXISTS "teamDescription" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "teamGovernorate" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "membersCount"    INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "foundedYear"     INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "teamSocials"     JSONB DEFAULT '{}'::jsonb;  -- {instagram,x,youtube,tiktok,website,whatsapp}

-- Events run by a team.
CREATE TABLE IF NOT EXISTS team_events (
  id            TEXT PRIMARY KEY,
  "teamId"      TEXT NOT NULL,
  title         TEXT NOT NULL,
  "titleAr"     TEXT,
  category      TEXT,
  description   TEXT,
  governorate   TEXT,
  location      TEXT,                 -- venue / area
  "eventDate"   DATE,
  "startTime"   TEXT,
  "endTime"     TEXT,
  "ticketPrice" NUMERIC(10,3) DEFAULT 0,  -- OMR; 0 = free
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

-- Add a team default to the commission settings.
UPDATE site_settings
SET value = value || '{"team": 0.10}'::jsonb
WHERE key = 'commission' AND NOT (value ? 'team');
