-- 023_message_attachments.sql
-- Adds attachment support to the messages table (images / files in chat).
-- Safe to run multiple times (IF NOT EXISTS). Until this runs, the app strips
-- these fields and sends text-only (resilient insert), so nothing breaks.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS "attachmentUrl"  text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "attachmentType" text;  -- 'image' | 'file'
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "attachmentName" text;
