-- Migration 010 — Guide analytics, achievements & payouts

-- ─── TOUR VIEWS (track popularity) ────────────────────────────
CREATE TABLE IF NOT EXISTS tour_views (
  id          TEXT PRIMARY KEY,
  "packageId" TEXT NOT NULL,
  "guideId"   TEXT,
  "viewerId"  TEXT,
  "viewerIp"  TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_views_package ON tour_views ("packageId");
CREATE INDEX IF NOT EXISTS idx_tour_views_guide   ON tour_views ("guideId");
CREATE INDEX IF NOT EXISTS idx_tour_views_date    ON tour_views ("createdAt" DESC);

ALTER TABLE tour_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tour_views_all" ON tour_views;
CREATE POLICY "tour_views_all" ON tour_views FOR ALL USING (true) WITH CHECK (true);

-- ─── PAYOUTS (track earnings) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS guide_payouts (
  id          TEXT PRIMARY KEY,
  "guideId"   TEXT NOT NULL,
  amount      NUMERIC(10, 2) NOT NULL,
  "bookingIds" JSONB DEFAULT '[]'::jsonb,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  "paidAt"    TIMESTAMPTZ,
  "paidBy"    TEXT,
  notes       TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_guide  ON guide_payouts ("guideId");
CREATE INDEX IF NOT EXISTS idx_payouts_status ON guide_payouts (status);

ALTER TABLE guide_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payouts_all" ON guide_payouts;
CREATE POLICY "payouts_all" ON guide_payouts FOR ALL USING (true) WITH CHECK (true);

-- Achievements are computed dynamically (no table needed)
