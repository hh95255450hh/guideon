-- ════════════════════════════════════════════════════════════════════
--  Migration 016 — Fix Storage bucket policies so uploads work
-- ════════════════════════════════════════════════════════════════════
-- Symptom: all photo uploads (avatar, gallery, tour covers) return
-- "Upload failed" because the bucket has RLS but no policies.

-- 1. Make sure the 'media' bucket exists and is PUBLIC for reading.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif'];

-- 2. Drop any existing policies so we have a clean slate.
DROP POLICY IF EXISTS "media_public_read"     ON storage.objects;
DROP POLICY IF EXISTS "media_anon_insert"     ON storage.objects;
DROP POLICY IF EXISTS "media_anon_update"     ON storage.objects;
DROP POLICY IF EXISTS "media_anon_delete"     ON storage.objects;

-- 3. Anyone can READ files (it's public content).
CREATE POLICY "media_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'media');

-- 4. Anyone (including anon role used by our backend) can INSERT.
--    The app already checks requireLogin before letting users upload,
--    so server-side auth gates access.
CREATE POLICY "media_anon_insert"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'media');

-- 5. Anyone can UPDATE (used when overwriting an avatar).
CREATE POLICY "media_anon_update"
  ON storage.objects FOR UPDATE
  TO public
  USING (bucket_id = 'media');

-- 6. Anyone can DELETE (used when deleting old avatars/gallery items).
CREATE POLICY "media_anon_delete"
  ON storage.objects FOR DELETE
  TO public
  USING (bucket_id = 'media');
