-- 025_app_sessions.sql
-- Persistent session storage so users stay logged in across server restarts
-- and deploys (fixes "Please log in to continue" after every deploy).
-- Used by src/config/supabaseSessionStore.js via the anon key.
--
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS app_sessions (
  sid    text PRIMARY KEY,
  sess   jsonb NOT NULL,
  expire timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_expire ON app_sessions (expire);

ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_sessions_all ON app_sessions;
CREATE POLICY app_sessions_all ON app_sessions
  FOR ALL TO public USING (true) WITH CHECK (true);
