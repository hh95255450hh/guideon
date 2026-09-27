-- 056_migration_tracking.sql
-- Adds a tracking table so "which numbered migrations have actually been
-- applied to this database" is a query, not a guess. Migrations 001-055 were
-- applied manually over time with no record kept (ALL_MIGRATIONS.sql is stale,
-- covering only 001-005) — this is the fix going forward.
--
-- Run once in this order:
--   1) This file (creates the table).
--   2) database/migrations/_backfill_applied.sql (marks 001-055 as already
--      applied — they ARE already live on this DB; this just records that fact,
--      it does NOT re-run their DDL).
--   Every migration from 057 onward should INSERT itself into this table as
--   its last statement (see the template at the bottom of this file).

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     integer PRIMARY KEY,        -- e.g. 56 for 056_migration_tracking.sql
  filename    text NOT NULL,
  applied_at  timestamptz NOT NULL DEFAULT now(),
  applied_by  text                        -- free-text: who/what ran it (owner name, "claude", etc.)
);

INSERT INTO schema_migrations (version, filename, applied_by)
VALUES (56, '056_migration_tracking.sql', 'system')
ON CONFLICT (version) DO NOTHING;

-- ── Template for every future migration file — copy this as the LAST
-- statement in any new NNN_description.sql (replace NNN and the filename):
--
-- INSERT INTO schema_migrations (version, filename, applied_by)
-- VALUES (NNN, 'NNN_description.sql', 'owner')
-- ON CONFLICT (version) DO NOTHING;
