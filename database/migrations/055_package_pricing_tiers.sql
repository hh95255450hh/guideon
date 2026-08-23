-- 055_package_pricing_tiers.sql
-- Flexible group-size + age-based tour pricing (TripAdvisor-style).
-- Companies price by number of guests (e.g. 1-2 = 6 OMR flat, 3-4 = 8, 8+ = 1.5/person)
-- and by age (adult / child 6-12 / free under 6). The legacy simple model
-- (price_adult = base for 2, price_child = per extra) still works when
-- pricing_mode = 'simple' (the default), so existing packages are unaffected.
--
-- Run once in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS).

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS pricing_mode   text    NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS pricing_tiers  jsonb   NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS child_price    numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS child_age_min  integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS child_age_max  integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS free_under_age integer NOT NULL DEFAULT 6;

-- pricing_tiers shape (array of brackets, chosen by adult count):
--   [{ "from": 1, "to": 2,    "price": 6,   "mode": "flat" },
--    { "from": 3, "to": 4,    "price": 8,   "mode": "flat" },
--    { "from": 8, "to": null, "price": 1.5, "mode": "per_person" }]
