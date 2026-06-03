-- ============================================================================
-- 027_enable_rls_lockdown.sql
-- ----------------------------------------------------------------------------
-- PURPOSE
--   Close the Supabase security findings:
--     • rls_disabled_in_public   — tables with NO Row-Level Security
--     • sensitive_columns_exposed — data readable via the public (anon) API
--
--   This migration:
--     1) Drops every existing PERMISSIVE policy (the old `USING (true)` ones
--        that let anyone read/write), and
--     2) Enables Row-Level Security on EVERY table in the `public` schema.
--
--   With RLS on and NO policies, the anon/publishable key can no longer read or
--   write any row. The application server connects with the SERVICE-ROLE key,
--   which BYPASSES RLS, so the app keeps working exactly as before.
--
--   NOTE: This only touches the `public` schema. Storage policies (storage
--   schema) are left intact, so image/video uploads and public reads still work.
--
-- ⚠️  PREREQUISITE — DO THIS FIRST, IN THIS ORDER:
--   1. In Supabase → Project Settings → API → copy the `service_role` secret.
--   2. In Railway → your service → Variables → add:
--          SUPABASE_SERVICE_ROLE_KEY = <that secret>
--      Save and let it redeploy (~2 min).
--   3. Confirm the live site still works (log in, open a page that loads data).
--   4. ONLY THEN run this migration in the Supabase SQL Editor.
--
--   If you run this BEFORE the service-role key is live, the app (still using
--   the anon key) will lose all database access until the key is added.
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1) Remove all existing permissive policies in the public schema.
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
  END LOOP;

  -- 2) Enable (force) Row-Level Security on every public table.
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- Verify (optional): every public table should now show rowsecurity = true
-- and have zero policies.
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';
--   SELECT * FROM pg_policies WHERE schemaname='public';
-- ----------------------------------------------------------------------------
