-- 026_users_createdby.sql
-- Adds the createdBy column the staff-creation flow writes (who created the
-- staff/admin account). Optional — the app already strips it when missing,
-- so staff can be created without this; run it to actually store the value.
--
-- Safe to run multiple times.

ALTER TABLE users ADD COLUMN IF NOT EXISTS "createdBy" text;
