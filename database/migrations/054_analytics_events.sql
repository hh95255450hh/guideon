-- 054_analytics_events.sql
-- Lightweight funnel event table to track conversion steps:
--   page_view → book_click → checkout_start → payment_complete
-- Intentionally minimal — no PII stored, just event name + metadata.
CREATE TABLE IF NOT EXISTS analytics_events (
  id           text PRIMARY KEY,
  event        text NOT NULL,
  "packageId"  text,
  "guideId"    text,
  "userId"     text,
  "sessionRef" text,
  meta         jsonb DEFAULT '{}',
  ip           text,
  "createdAt"  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_name ON analytics_events (event);
CREATE INDEX IF NOT EXISTS idx_analytics_event_pkg  ON analytics_events ("packageId") WHERE "packageId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_event_time ON analytics_events ("createdAt");

NOTIFY pgrst, 'reload schema';
