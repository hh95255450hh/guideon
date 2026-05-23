-- ════════════════════════════════════════════════════════════════════
--  Migration 017 — In-app Notifications
-- ════════════════════════════════════════════════════════════════════
-- Universal notification bell shown in the navbar for every user type
-- (tourist / guide / company / admin).
--
-- Notifications are written from server-side events (new booking, accepted
-- booking, new message, trip started/ended, etc.) and read by a simple
-- list endpoint that the frontend polls every ~30s.

CREATE TABLE IF NOT EXISTS notifications (
  id          text PRIMARY KEY,
  "userId"    text NOT NULL,
  type        text NOT NULL,        -- booking_new / booking_accepted / booking_cancelled / message / trip_start / trip_end / system / payout
  title       text NOT NULL,
  body        text,
  link        text,                 -- where to go when clicked
  icon        text,                 -- emoji or icon code
  "isRead"    boolean NOT NULL DEFAULT false,
  metadata    jsonb,                -- arbitrary data (bookingId, conversationId, etc.)
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "readAt"    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications ("userId", "isRead", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
  ON notifications ("userId", "createdAt" DESC);

-- Old notifications cleanup helper (call manually or via a cron later)
-- Notifications older than 90 days are auto-deleted to keep the table small.
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM notifications WHERE "createdAt" < now() - interval '90 days';
$$;

-- User notification preferences (opt-in/out per channel)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "notifPrefs" jsonb DEFAULT
    '{"email":{"bookings":true,"messages":true,"reminders":true,"marketing":false},
      "inapp":{"bookings":true,"messages":true,"reminders":true,"system":true}}'::jsonb;
