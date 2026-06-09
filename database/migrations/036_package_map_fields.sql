-- 036_package_map_fields.sql
-- Adds the interactive-map fields to tour_packages so guides/companies
-- can mark a meeting point and an expected route on a map, and tourists
-- can see them on the package page.
--
-- meetingPoint  → { lat: number, lng: number, label_ar?, label_en? }
-- route         → [ { lat: number, lng: number }, ... ]  (ordered)
--
-- Safe to run multiple times.

ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "meetingPoint" jsonb;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "route"        jsonb;
