-- Multi-category support for tour packages.
-- The legacy `category` text column stays for back-compat; a tour can also
-- expose multiple categories via the new `categories` jsonb array.
ALTER TABLE tour_packages
  ADD COLUMN IF NOT EXISTS categories jsonb NOT NULL DEFAULT '[]'::jsonb;

-- GIN index for fast "tour has category X" lookups
CREATE INDEX IF NOT EXISTS idx_tour_packages_categories
  ON tour_packages USING GIN (categories);

-- Back-fill: copy the existing single category into the array (if not already)
UPDATE tour_packages
SET categories = jsonb_build_array(category)
WHERE category IS NOT NULL
  AND category <> ''
  AND (categories IS NULL OR categories = '[]'::jsonb);
