-- ============================================================================
-- 032_user_guide_assets.sql
-- ----------------------------------------------------------------------------
-- Ensure the column guides write to when adding "مميزاتي" (cars, boats, camps,
-- equipment) actually exists. Without it, the PUT /api/guides/me/assets call
-- succeeded silently from the UI but the data never landed — so tourists saw
-- an empty section even after the guide saved.
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS "guideAssets" jsonb DEFAULT '[]'::jsonb;
