-- 024_push_subscriptions.sql
-- Stores browser Web Push (VAPID) subscriptions so the server can send push
-- notifications even when the site is closed. One user may have several
-- devices/browsers, so endpoint is the unique key.
--
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         text PRIMARY KEY,
  "userId"   text NOT NULL,
  endpoint   text NOT NULL UNIQUE,
  keys       jsonb NOT NULL,          -- { p256dh, auth }
  "userAgent" text,
  "createdAt" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions ("userId");

-- Allow the anon key (used by the backend) to read/write — server gates access
-- with requireLogin, same pattern as the rest of the app.
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subs_all ON push_subscriptions;
CREATE POLICY push_subs_all ON push_subscriptions
  FOR ALL TO public USING (true) WITH CHECK (true);
