-- Migration 009 — Hotel-style tour variants & add-ons
-- Variants = tiered packages (like hotel rooms): Standard / Premium / VIP
-- Add-ons  = optional extras: lunch, transport, photographer, etc.

ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS variants     JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS addons       JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "availableDates" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS highlights   JSONB DEFAULT '[]'::jsonb;

-- variants example:
-- [{ id, name, description, priceAdult, priceChild, includes:[], maxGroupSize, badge }]

-- addons example:
-- [{ id, name, description, price, optional:true }]

-- availableDates example:
-- ["2026-06-15", "2026-06-22", ...]

-- highlights example:
-- ["Sunset views", "Camel ride included", "Traditional meal"]
