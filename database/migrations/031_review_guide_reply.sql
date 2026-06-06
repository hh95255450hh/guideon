-- ============================================================================
-- 031_review_guide_reply.sql
-- ----------------------------------------------------------------------------
-- Let guides publicly reply to a tourist's review (builds trust / engagement).
-- ============================================================================

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "guideReply"   text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "guideReplyAt" timestamptz;
