-- Migration 008 — Add offers/discounts to tour_packages
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "discountPercent" INTEGER DEFAULT 0 CHECK ("discountPercent" >= 0 AND "discountPercent" <= 90);
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "offerLabel"      TEXT;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "offerUntil"      TIMESTAMPTZ;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "guideId"         TEXT;

CREATE INDEX IF NOT EXISTS idx_tour_packages_active_offer
  ON tour_packages ("discountPercent")
  WHERE "discountPercent" > 0 AND "isPublished" = true;
