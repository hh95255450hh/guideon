-- ============================================================================
-- 044_uploaded_video.sql
-- ----------------------------------------------------------------------------
-- Let providers attach a self-hosted intro/tour video (uploaded file) in
-- addition to the existing YouTube `videoUrl`. Stored as a public storage URL.
-- Applies to guides + companies (users) and to tour packages.
-- Safe to re-run.
-- ============================================================================

ALTER TABLE users          ADD COLUMN IF NOT EXISTS "videoFileUrl" TEXT;
ALTER TABLE tour_packages  ADD COLUMN IF NOT EXISTS "videoFileUrl" TEXT;
