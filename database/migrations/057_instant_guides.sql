-- 057_instant_guides.sql
-- "Instant guide" (المرشد الفوري): guides switch on "available now", share an
-- approximate live location and an hourly rate; tourists see nearby available
-- guides on a map and send an instant request. On accept, a normal booking is
-- created in 'awaiting_payment' and paid through the existing Paymob checkout.

-- Guide-side availability state (on the users row).
ALTER TABLE users ADD COLUMN IF NOT EXISTS "instantAvailable"  BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "instantLat"        DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "instantLng"        DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "instantHourlyRate" NUMERIC(10,3);
ALTER TABLE users ADD COLUMN IF NOT EXISTS "instantUpdatedAt"  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_instant_available
  ON users ("instantAvailable") WHERE "instantAvailable" = TRUE;

-- One row per tourist → guide instant request.
CREATE TABLE IF NOT EXISTS instant_requests (
  id            TEXT PRIMARY KEY,
  "touristId"   TEXT NOT NULL,
  "guideId"     TEXT NOT NULL,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  hours         INTEGER NOT NULL,
  "hourlyRate"  NUMERIC(10,3) NOT NULL,
  "totalAmount" NUMERIC(10,3) NOT NULL,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending | accepted | declined | expired | cancelled
  "bookingId"   TEXT,
  "createdAt"   TIMESTAMPTZ DEFAULT NOW(),
  "respondedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_instant_requests_guide   ON instant_requests ("guideId", status);
CREATE INDEX IF NOT EXISTS idx_instant_requests_tourist ON instant_requests ("touristId", "createdAt" DESC);

-- App-only authorization (service-role key); keep RLS consistent with other tables.
ALTER TABLE instant_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "instant_requests_all" ON instant_requests;
CREATE POLICY "instant_requests_all" ON instant_requests FOR ALL USING (true) WITH CHECK (true);

INSERT INTO schema_migrations (version, filename, applied_by)
VALUES (57, '057_instant_guides.sql', 'claude')
ON CONFLICT (version) DO NOTHING;
