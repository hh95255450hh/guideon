-- 050_tour_views.sql
-- Tour-page view tracking. The feature (recordView + guide analytics) shipped
-- but this table was never created, so every view insert failed silently and
-- "Total Views" / "Conversion" always read 0. Creating it activates them.
CREATE TABLE IF NOT EXISTS tour_views (
  "id"         text PRIMARY KEY,
  "packageId"  text,
  "guideId"    text,
  "viewerId"   text,
  "viewerIp"   text,
  "createdAt"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tour_views_guide   ON tour_views ("guideId");
CREATE INDEX IF NOT EXISTS idx_tour_views_package ON tour_views ("packageId");
CREATE INDEX IF NOT EXISTS idx_tour_views_created ON tour_views ("createdAt");

-- App uses the service-role key (RLS bypassed); keep a permissive policy for parity.
ALTER TABLE tour_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tour_views_all ON tour_views;
CREATE POLICY tour_views_all ON tour_views USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
