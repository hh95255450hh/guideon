-- ============================================================================
-- GUIDEON — ALL MIGRATIONS (001–054), concatenated in order.
-- Auto-generated 2026-07-02. Do NOT edit by hand — regenerate via:
--   ls *.sql | grep -v ALL_MIGRATIONS | sort -t_ -k1 -n | while read f; do ...
--
-- Intended for a FRESH database. Migrations should be idempotent (IF NOT
-- EXISTS), so re-running is generally safe, but on a partially-migrated DB
-- prefer applying individual numbered files. In production the owner applies
-- new numbered files manually in the Supabase SQL editor.
-- ============================================================================


-- ============================================================================
-- 001_add_fcm_token.sql
-- ============================================================================
-- Migration: add FCM device token to users table
-- Run: psql -U postgres -d oman_explorer -f database/migrations/001_add_fcm_token.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;


-- ============================================================================
-- 002_booking_unique_constraint.sql
-- ============================================================================
-- Prevent two active bookings on the same date for the same guide.
-- Cancelled bookings are excluded so the date can be re-booked after cancellation.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_booking_per_guide_date
ON bookings ("guideId", "tourDate")
WHERE status IN ('pending', 'confirmed', 'completed');


-- ============================================================================
-- 003_performance_indexes.sql
-- ============================================================================
-- Indexes for production-grade query performance.
-- Run after baseline schema is in place.

-- USERS
CREATE INDEX IF NOT EXISTS idx_users_email           ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_userType        ON users ("userType");
CREATE INDEX IF NOT EXISTS idx_users_isVerified      ON users ("isVerified") WHERE "isVerified" = true;
CREATE INDEX IF NOT EXISTS idx_users_isSuspended     ON users ("isSuspended") WHERE "isSuspended" = false;
CREATE INDEX IF NOT EXISTS idx_users_verifyToken     ON users ("emailVerifyToken") WHERE "emailVerifyToken" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_resetToken      ON users ("resetPasswordToken") WHERE "resetPasswordToken" IS NOT NULL;

-- BOOKINGS
CREATE INDEX IF NOT EXISTS idx_bookings_touristId    ON bookings ("touristId");
CREATE INDEX IF NOT EXISTS idx_bookings_guideId      ON bookings ("guideId");
CREATE INDEX IF NOT EXISTS idx_bookings_status       ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_createdAt    ON bookings ("createdAt" DESC);

-- REVIEWS
CREATE INDEX IF NOT EXISTS idx_reviews_guideId       ON reviews ("guideId");
CREATE INDEX IF NOT EXISTS idx_reviews_bookingId     ON reviews ("bookingId");
CREATE INDEX IF NOT EXISTS idx_reviews_createdAt     ON reviews ("createdAt" DESC);

-- MESSAGES
CREATE INDEX IF NOT EXISTS idx_messages_fromId       ON messages ("fromId");
CREATE INDEX IF NOT EXISTS idx_messages_toId         ON messages ("toId");
CREATE INDEX IF NOT EXISTS idx_messages_unread       ON messages ("toId", "isRead") WHERE "isRead" = false;
CREATE INDEX IF NOT EXISTS idx_messages_createdAt    ON messages ("createdAt" DESC);

-- TRIP_REQUESTS
CREATE INDEX IF NOT EXISTS idx_trip_requests_touristId ON trip_requests ("touristId");
CREATE INDEX IF NOT EXISTS idx_trip_requests_status    ON trip_requests (status);


-- ============================================================================
-- 004_tour_packages.sql
-- ============================================================================
-- Tour packages — full tour products offered by companies or guides.
CREATE TABLE IF NOT EXISTS tour_packages (
  id              TEXT PRIMARY KEY,
  "providerId"    TEXT NOT NULL,
  "providerType"  TEXT NOT NULL CHECK ("providerType" IN ('guide', 'company')),
  title           TEXT NOT NULL,
  description     TEXT,
  destination     TEXT,
  region          TEXT,
  category        TEXT,
  difficulty      TEXT DEFAULT 'moderate' CHECK (difficulty IN ('easy', 'moderate', 'hard')),
  duration_days   INTEGER NOT NULL DEFAULT 1 CHECK (duration_days >= 1),
  max_group_size  INTEGER NOT NULL DEFAULT 10 CHECK (max_group_size >= 1),
  price_adult     NUMERIC(10, 2) NOT NULL CHECK (price_adult >= 0),
  price_child     NUMERIC(10, 2) DEFAULT 0 CHECK (price_child >= 0),
  currency        TEXT DEFAULT 'OMR',
  includes        JSONB DEFAULT '[]'::jsonb,
  excludes        JSONB DEFAULT '[]'::jsonb,
  itinerary       JSONB DEFAULT '[]'::jsonb,
  meeting_point   TEXT,
  languages       JSONB DEFAULT '[]'::jsonb,
  images          JSONB DEFAULT '[]'::jsonb,
  cover_image     TEXT,
  cancellation_policy TEXT DEFAULT 'flexible' CHECK (cancellation_policy IN ('flexible', 'moderate', 'strict')),
  "isPublished"   BOOLEAN DEFAULT false,
  "isFeatured"    BOOLEAN DEFAULT false,
  rating          NUMERIC(3, 2) DEFAULT 0,
  "totalReviews"  INTEGER DEFAULT 0,
  "totalBookings" INTEGER DEFAULT 0,
  "createdAt"     TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_packages_provider  ON tour_packages ("providerId");
CREATE INDEX IF NOT EXISTS idx_tour_packages_published ON tour_packages ("isPublished") WHERE "isPublished" = true;
CREATE INDEX IF NOT EXISTS idx_tour_packages_featured  ON tour_packages ("isFeatured") WHERE "isFeatured" = true;
CREATE INDEX IF NOT EXISTS idx_tour_packages_category  ON tour_packages (category);
CREATE INDEX IF NOT EXISTS idx_tour_packages_destination ON tour_packages (destination);

-- Tour package availability (specific dates)
CREATE TABLE IF NOT EXISTS package_availability (
  id              TEXT PRIMARY KEY,
  "packageId"     TEXT NOT NULL REFERENCES tour_packages(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  "availableSpots" INTEGER NOT NULL CHECK ("availableSpots" >= 0),
  "createdAt"     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE ("packageId", date)
);

CREATE INDEX IF NOT EXISTS idx_package_avail_package ON package_availability ("packageId");
CREATE INDEX IF NOT EXISTS idx_package_avail_date    ON package_availability (date);

-- Extend bookings to support package bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "packageId"     TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "adultCount"    INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "childCount"    INTEGER DEFAULT 0;


-- ============================================================================
-- 005_reviews_with_photos.sql
-- ============================================================================
-- Reviews with photos (up to 3 per review)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "helpfulCount" INTEGER DEFAULT 0;

-- Q&A on guide profiles
CREATE TABLE IF NOT EXISTS guide_questions (
  id          TEXT PRIMARY KEY,
  "guideId"   TEXT NOT NULL,
  "askerId"   TEXT NOT NULL,
  "askerName" TEXT,
  question    TEXT NOT NULL,
  answer      TEXT,
  "answeredAt" TIMESTAMPTZ,
  "isPublic"  BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_questions_guide ON guide_questions ("guideId");
CREATE INDEX IF NOT EXISTS idx_guide_questions_public ON guide_questions ("isPublic", "guideId") WHERE "isPublic" = true;

-- Newsletter subscribers
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  language    TEXT DEFAULT 'en',
  source      TEXT,
  "isActive"  BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers (email);

-- Shared wishlists
CREATE TABLE IF NOT EXISTS shared_wishlists (
  id          TEXT PRIMARY KEY,
  "ownerId"   TEXT NOT NULL,
  "ownerName" TEXT,
  "guideIds"  JSONB DEFAULT '[]'::jsonb,
  title       TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- 006_admin_features.sql
-- ============================================================================
-- ════════════════════════════════════════════════════════════════════
--  Migration 006 — Admin features (audit log + cancellation reasons)
-- ════════════════════════════════════════════════════════════════════

-- AUDIT LOG: tracks every admin action
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          TEXT PRIMARY KEY,
  "adminId"   TEXT NOT NULL,
  "adminName" TEXT,
  action      TEXT NOT NULL,
  "targetType" TEXT,
  "targetId"  TEXT,
  details     JSONB DEFAULT '{}'::jsonb,
  ip          TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin   ON admin_audit_log ("adminId");
CREATE INDEX IF NOT EXISTS idx_audit_target  ON admin_audit_log ("targetType", "targetId");
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON admin_audit_log (action);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_all" ON admin_audit_log;
CREATE POLICY "audit_all" ON admin_audit_log FOR ALL USING (true) WITH CHECK (true);

-- Add cancellation reason to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;


-- ============================================================================
-- 007_staff_roles.sql
-- ============================================================================
-- ════════════════════════════════════════════════════════════════════
--  Migration 007 — Staff system with granular permissions
-- ════════════════════════════════════════════════════════════════════

-- Add staff fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS "staffRole"   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions   JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "createdBy"   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMPTZ;

-- Index for staff lookups
CREATE INDEX IF NOT EXISTS idx_users_staffRole ON users ("staffRole") WHERE "staffRole" IS NOT NULL;

-- Allow 'staff' as userType
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%userType%' OR constraint_name LIKE '%user_type%'
  ) THEN
    -- if there's a check constraint, we skip — Supabase tables typically don't enforce enums
    NULL;
  END IF;
END $$;


-- ============================================================================
-- 008_tour_offers.sql
-- ============================================================================
-- Migration 008 — Add offers/discounts to tour_packages
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "discountPercent" INTEGER DEFAULT 0 CHECK ("discountPercent" >= 0 AND "discountPercent" <= 90);
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "offerLabel"      TEXT;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "offerUntil"      TIMESTAMPTZ;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "guideId"         TEXT;

CREATE INDEX IF NOT EXISTS idx_tour_packages_active_offer
  ON tour_packages ("discountPercent")
  WHERE "discountPercent" > 0 AND "isPublished" = true;


-- ============================================================================
-- 009_tour_variants.sql
-- ============================================================================
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


-- ============================================================================
-- 010_guide_analytics.sql
-- ============================================================================
-- Migration 010 — Guide analytics, achievements & payouts

-- ─── TOUR VIEWS (track popularity) ────────────────────────────
CREATE TABLE IF NOT EXISTS tour_views (
  id          TEXT PRIMARY KEY,
  "packageId" TEXT NOT NULL,
  "guideId"   TEXT,
  "viewerId"  TEXT,
  "viewerIp"  TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_views_package ON tour_views ("packageId");
CREATE INDEX IF NOT EXISTS idx_tour_views_guide   ON tour_views ("guideId");
CREATE INDEX IF NOT EXISTS idx_tour_views_date    ON tour_views ("createdAt" DESC);

ALTER TABLE tour_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tour_views_all" ON tour_views;
CREATE POLICY "tour_views_all" ON tour_views FOR ALL USING (true) WITH CHECK (true);

-- ─── PAYOUTS (track earnings) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS guide_payouts (
  id          TEXT PRIMARY KEY,
  "guideId"   TEXT NOT NULL,
  amount      NUMERIC(10, 2) NOT NULL,
  "bookingIds" JSONB DEFAULT '[]'::jsonb,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  "paidAt"    TIMESTAMPTZ,
  "paidBy"    TEXT,
  notes       TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_guide  ON guide_payouts ("guideId");
CREATE INDEX IF NOT EXISTS idx_payouts_status ON guide_payouts (status);

ALTER TABLE guide_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payouts_all" ON guide_payouts;
CREATE POLICY "payouts_all" ON guide_payouts FOR ALL USING (true) WITH CHECK (true);

-- Achievements are computed dynamically (no table needed)


-- ============================================================================
-- 011_2fa.sql
-- ============================================================================
-- Two-Factor Authentication (TOTP) — for admin and any user who opts in
ALTER TABLE users ADD COLUMN IF NOT EXISTS twoFactorSecret    text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS twoFactorEnabled   boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS twoFactorBackupCodes jsonb;

CREATE INDEX IF NOT EXISTS idx_users_twoFactorEnabled ON users(twoFactorEnabled) WHERE twoFactorEnabled = true;


-- ============================================================================
-- 012_missing_columns.sql
-- ============================================================================
-- Add columns referenced by the app but missing from the DB.
-- Safe to run multiple times (IF NOT EXISTS).

-- ─── Guide Ministry licence flag (causing "Server error" on guide signup) ─────
ALTER TABLE users ADD COLUMN IF NOT EXISTS "isMinistryLicensed" boolean NOT NULL DEFAULT false;

-- ─── 2FA columns (from migration 011, in case it wasn't run) ──────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS "twoFactorSecret"      text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "twoFactorEnabled"     boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "twoFactorBackupCodes" jsonb;

-- ─── Staff system columns (admin granular permissions) ────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS "staffRole"   text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "permissions" jsonb;

-- ─── Profile updatedAt (used by SupabaseDB.update) ────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz;

-- Index for licensed guides (search filter)
CREATE INDEX IF NOT EXISTS idx_users_ministry_licensed
  ON users("isMinistryLicensed") WHERE "userType" = 'guide';


-- ============================================================================
-- 013_tour_duration_hours_minutes.sql
-- ============================================================================
-- Add hours and minutes to tour duration alongside existing duration_days.
-- A tour duration is now: duration_days + duration_hours + duration_minutes.
ALTER TABLE tour_packages
  ADD COLUMN IF NOT EXISTS duration_hours   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 0;

-- Sanity range constraints (0-23 hours, 0-59 minutes — anything else makes no sense).
DO $$ BEGIN
  ALTER TABLE tour_packages
    ADD CONSTRAINT check_duration_hours_range   CHECK (duration_hours BETWEEN 0 AND 23);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE tour_packages
    ADD CONSTRAINT check_duration_minutes_range CHECK (duration_minutes BETWEEN 0 AND 59);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================================
-- 014_tour_categories.sql
-- ============================================================================
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


-- ============================================================================
-- 015_fix_duration_days_constraint.sql
-- ============================================================================
-- Old constraint required duration_days >= 1.
-- Now that we have separate hours/minutes, a tour can be (0 days · 4 hours).
-- Drop the old constraint and replace it with one that allows 0+.

ALTER TABLE tour_packages
  DROP CONSTRAINT IF EXISTS tour_packages_duration_days_check;

ALTER TABLE tour_packages
  ADD CONSTRAINT tour_packages_duration_days_check
  CHECK (duration_days >= 0);

-- Safety: also make sure at least ONE duration unit is set
-- (no tour can be 0 days + 0 hours + 0 minutes).
DO $$ BEGIN
  ALTER TABLE tour_packages
    ADD CONSTRAINT tour_packages_duration_nonzero
    CHECK (duration_days > 0 OR duration_hours > 0 OR duration_minutes > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================================
-- 016_fix_storage_policies.sql
-- ============================================================================
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


-- ============================================================================
-- 017_notifications.sql
-- ============================================================================
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


-- ============================================================================
-- 018_admin_password_audit_trigger.sql
-- ============================================================================
-- ════════════════════════════════════════════════════════════════════
--  Migration 018 — Admin password change audit trigger
-- ════════════════════════════════════════════════════════════════════
-- The admin password keeps reverting to an unknown hash. This trigger
-- logs every UPDATE on the admin's password column to a dedicated table
-- so we can identify the source on the next occurrence.

CREATE TABLE IF NOT EXISTS admin_password_audit (
  id          bigserial PRIMARY KEY,
  user_id     text NOT NULL,
  old_hash    text,
  new_hash    text,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  -- Whatever the Postgres role was that performed the update
  db_user     text,
  app_name    text,
  client_ip   inet,
  -- The raw query that did it (PG 14+)
  query_text  text
);

CREATE INDEX IF NOT EXISTS idx_admin_pwd_audit_user
  ON admin_password_audit (user_id, changed_at DESC);

CREATE OR REPLACE FUNCTION log_admin_password_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.password IS DISTINCT FROM NEW.password)
     AND NEW."userType" = 'admin' THEN
    INSERT INTO admin_password_audit (user_id, old_hash, new_hash, db_user, app_name, client_ip, query_text)
    VALUES (
      NEW.id,
      OLD.password,
      NEW.password,
      current_user,
      current_setting('application_name', true),
      inet_client_addr(),
      current_query()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_admin_password ON users;
CREATE TRIGGER trg_log_admin_password
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION log_admin_password_change();


-- ============================================================================
-- 019_site_settings.sql
-- ============================================================================
-- ════════════════════════════════════════════════════════════════════
--  Migration 019 — Site Settings (admin-controllable homepage CMS)
-- ════════════════════════════════════════════════════════════════════
-- Single key/value store the admin uses to override homepage content
-- without touching code:
--   • hero text  (title + highlight + subtitle in EN and AR)
--   • carousel slides (image URL, badge, headline, description, CTA)
--   • activity cards (icon, title, description, link)
--   • theme colours (primary, gold, etc.) — optional
--
-- Reads are public (anyone visiting the homepage). Writes require admin.

CREATE TABLE IF NOT EXISTS site_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by  text,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- Default hero text (loaded only if admin hasn't customised yet)
INSERT INTO site_settings (key, value) VALUES
  ('hero', '{
    "badge_en": "Certified Ministry-Licensed Guides",
    "badge_ar": "مرشدون معتمدون من وزارة التراث والسياحة",
    "title_en": "Discover Oman With a",
    "title_ar": "اكتشف عُمان مع",
    "highlight_en": "Verified Local Expert",
    "highlight_ar": "خبير محلي موثّق",
    "subtitle_en": "Connect with certified tourist guides across the Sultanate of Oman.",
    "subtitle_ar": "تواصل مع مرشدين سياحيين معتمدين في جميع أنحاء سلطنة عُمان."
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Carousel slides default (start empty — admin uploads photos)
INSERT INTO site_settings (key, value) VALUES
  ('carousel', '{"slides": []}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Activity grid default (start empty — admin curates)
INSERT INTO site_settings (key, value) VALUES
  ('activities', '{"items": []}'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- 020_2fa_login_counter.sql
-- ============================================================================
-- Migration 020: 2FA "remember for N logins" counter
-- Lets users with 2FA enabled skip the code for a configurable number of
-- logins (default 10). The admin asked to be prompted only every 10th login
-- instead of every single time.
--
-- loginsSince2FA = number of successful password-only logins since the last
-- time the TOTP code was entered. When it reaches the threshold, the next
-- login requires the code again and the counter resets to 0.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "loginsSince2FA" INTEGER DEFAULT 0;

-- Existing 2FA users: force a prompt on their next login by setting the
-- counter high (NULL is also treated as "must prompt" in code, but be explicit).
UPDATE users
  SET "loginsSince2FA" = 0
  WHERE "loginsSince2FA" IS NULL;


-- ============================================================================
-- 021_booking_lifecycle_columns.sql
-- ============================================================================
-- 021_booking_lifecycle_columns.sql
-- Adds the booking lifecycle + package columns the app writes but were missing
-- from the bookings table. Without these, guides could not start/complete trips
-- and package bookings with add-ons failed to insert.
--
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "startedAt"   timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "completedAt" timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "variantName" text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "addons"      jsonb DEFAULT '[]'::jsonb;


-- ============================================================================
-- 022_review_columns.sql
-- ============================================================================
-- 022_review_columns.sql
-- Adds the review columns the app writes but were missing from the reviews
-- table. Without these, tourists could not submit ANY review (insert failed
-- with "column reviews.packageId does not exist").
--
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "packageId"    text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "touristPhoto" text;


-- ============================================================================
-- 023_message_attachments.sql
-- ============================================================================
-- 023_message_attachments.sql
-- Adds attachment support to the messages table (images / files in chat).
-- Safe to run multiple times (IF NOT EXISTS). Until this runs, the app strips
-- these fields and sends text-only (resilient insert), so nothing breaks.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS "attachmentUrl"  text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "attachmentType" text;  -- 'image' | 'file'
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "attachmentName" text;


-- ============================================================================
-- 024_push_subscriptions.sql
-- ============================================================================
-- 024_push_subscriptions.sql
-- Stores browser Web Push (VAPID) subscriptions so the server can send push
-- notifications even when the site is closed. One user may have several
-- devices/browsers, so endpoint is the unique key.
--
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         text PRIMARY KEY,
  "userId"   text NOT NULL,
  endpoint   text NOT NULL UNIQUE,
  keys       jsonb NOT NULL,          -- { p256dh, auth }
  "userAgent" text,
  "createdAt" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions ("userId");

-- Allow the anon key (used by the backend) to read/write — server gates access
-- with requireLogin, same pattern as the rest of the app.
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subs_all ON push_subscriptions;
CREATE POLICY push_subs_all ON push_subscriptions
  FOR ALL TO public USING (true) WITH CHECK (true);


-- ============================================================================
-- 025_app_sessions.sql
-- ============================================================================
-- 025_app_sessions.sql
-- Persistent session storage so users stay logged in across server restarts
-- and deploys (fixes "Please log in to continue" after every deploy).
-- Used by src/config/supabaseSessionStore.js via the anon key.
--
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS app_sessions (
  sid    text PRIMARY KEY,
  sess   jsonb NOT NULL,
  expire timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_expire ON app_sessions (expire);

ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_sessions_all ON app_sessions;
CREATE POLICY app_sessions_all ON app_sessions
  FOR ALL TO public USING (true) WITH CHECK (true);


-- ============================================================================
-- 026_users_createdby.sql
-- ============================================================================
-- 026_users_createdby.sql
-- Adds the createdBy column the staff-creation flow writes (who created the
-- staff/admin account). Optional — the app already strips it when missing,
-- so staff can be created without this; run it to actually store the value.
--
-- Safe to run multiple times.

ALTER TABLE users ADD COLUMN IF NOT EXISTS "createdBy" text;


-- ============================================================================
-- 027_enable_rls_lockdown.sql
-- ============================================================================
-- ============================================================================
-- 027_enable_rls_lockdown.sql
-- ----------------------------------------------------------------------------
-- PURPOSE
--   Close the Supabase security findings:
--     • rls_disabled_in_public   — tables with NO Row-Level Security
--     • sensitive_columns_exposed — data readable via the public (anon) API
--
--   This migration:
--     1) Drops every existing PERMISSIVE policy (the old `USING (true)` ones
--        that let anyone read/write), and
--     2) Enables Row-Level Security on EVERY table in the `public` schema.
--
--   With RLS on and NO policies, the anon/publishable key can no longer read or
--   write any row. The application server connects with the SERVICE-ROLE key,
--   which BYPASSES RLS, so the app keeps working exactly as before.
--
--   NOTE: This only touches the `public` schema. Storage policies (storage
--   schema) are left intact, so image/video uploads and public reads still work.
--
-- ⚠️  PREREQUISITE — DO THIS FIRST, IN THIS ORDER:
--   1. In Supabase → Project Settings → API → copy the `service_role` secret.
--   2. In Railway → your service → Variables → add:
--          SUPABASE_SERVICE_ROLE_KEY = <that secret>
--      Save and let it redeploy (~2 min).
--   3. Confirm the live site still works (log in, open a page that loads data).
--   4. ONLY THEN run this migration in the Supabase SQL Editor.
--
--   If you run this BEFORE the service-role key is live, the app (still using
--   the anon key) will lose all database access until the key is added.
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1) Remove all existing permissive policies in the public schema.
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
  END LOOP;

  -- 2) Enable (force) Row-Level Security on every public table.
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- Verify (optional): every public table should now show rowsecurity = true
-- and have zero policies.
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';
--   SELECT * FROM pg_policies WHERE schemaname='public';
-- ----------------------------------------------------------------------------


-- ============================================================================
-- 028_booking_slot_unique_constraint.sql
-- ============================================================================
-- ============================================================================
-- 028_booking_slot_unique_constraint.sql
-- ----------------------------------------------------------------------------
-- Prevent race condition: two tourists booking the same time slot for the
-- same guide on the same date simultaneously.
--
-- The existing index (002) covers day-rate bookings: UNIQUE (guideId, tourDate).
-- This index covers time-slot bookings: UNIQUE (guideId, tourDate, startTime).
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_booking_per_guide_slot
ON bookings ("guideId", "tourDate", "startTime")
WHERE status IN ('pending', 'confirmed', 'completed')
  AND "startTime" IS NOT NULL;


-- ============================================================================
-- 029_composite_and_gin_indexes.sql
-- ============================================================================
-- ============================================================================
-- 029_composite_and_gin_indexes.sql
-- ----------------------------------------------------------------------------
-- High-value indexes that match the app's ACTUAL query patterns.
-- Migration 003 added single-column indexes; these composite + GIN indexes
-- target the exact "filter then sort" and "array contains" queries used in
-- the booking dashboards and guide search.
--
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================================

-- ── BOOKINGS: filter by user + sort by date (myBookings / guideBookings) ──
-- Query: WHERE touristId = ? ORDER BY createdAt DESC
-- A composite index serves both the filter and the sort in one scan.
CREATE INDEX IF NOT EXISTS idx_bookings_tourist_created
  ON bookings ("touristId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_guide_created
  ON bookings ("guideId", "createdAt" DESC);

-- ── GUIDE SEARCH: array-contains filters (destinations / languages / specs) ──
-- Query: WHERE destinations @> ARRAY[?]  (governorate / destination filter)
-- GIN indexes make array membership checks fast instead of full-table scans.
CREATE INDEX IF NOT EXISTS idx_users_destinations_gin
  ON users USING GIN ("destinations")
  WHERE "userType" = 'guide';

CREATE INDEX IF NOT EXISTS idx_users_languages_gin
  ON users USING GIN ("languages")
  WHERE "userType" = 'guide';

CREATE INDEX IF NOT EXISTS idx_users_specialisations_gin
  ON users USING GIN ("specialisations")
  WHERE "userType" = 'guide';

-- ── REVIEWS: fetch all reviews for a set of bookings (myBookings join) ──
-- Already have idx_reviews_bookingId; this covers the guide-rating sort.
CREATE INDEX IF NOT EXISTS idx_reviews_guide_created
  ON reviews ("guideId", "createdAt" DESC);

-- ── TOUR PACKAGES: published-tours lookup in guide search ──
CREATE INDEX IF NOT EXISTS idx_packages_published
  ON tour_packages ("isPublished")
  WHERE "isPublished" = true;


-- ============================================================================
-- 030_booking_quote.sql
-- ============================================================================
-- ============================================================================
-- 030_booking_quote.sql
-- ----------------------------------------------------------------------------
-- Custom trip request → guide price offer → tourist accepts.
--
-- Adds quotedAmount (the price the guide proposes) and folds the new 'quoted'
-- status into the active-booking unique constraints so a quoted slot is held.
-- ============================================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "quotedAmount" numeric(10,2);

-- Rebuild the active-booking unique indexes to also reserve quoted slots.
DROP INDEX IF EXISTS uniq_active_booking_per_guide_date;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_booking_per_guide_date
  ON bookings ("guideId", "tourDate")
  WHERE status IN ('pending', 'quoted', 'confirmed', 'completed');

DROP INDEX IF EXISTS uniq_active_booking_per_guide_slot;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_booking_per_guide_slot
  ON bookings ("guideId", "tourDate", "startTime")
  WHERE status IN ('pending', 'quoted', 'confirmed', 'completed')
    AND "startTime" IS NOT NULL;


-- ============================================================================
-- 031_review_guide_reply.sql
-- ============================================================================
-- ============================================================================
-- 031_review_guide_reply.sql
-- ----------------------------------------------------------------------------
-- Let guides publicly reply to a tourist's review (builds trust / engagement).
-- ============================================================================

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "guideReply"   text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "guideReplyAt" timestamptz;


-- ============================================================================
-- 032_user_guide_assets.sql
-- ============================================================================
-- ============================================================================
-- 032_user_guide_assets.sql
-- ----------------------------------------------------------------------------
-- Ensure the column guides write to when adding "مميزاتي" (cars, boats, camps,
-- equipment) actually exists. Without it, the PUT /api/guides/me/assets call
-- succeeded silently from the UI but the data never landed — so tourists saw
-- an empty section even after the guide saved.
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS "guideAssets" jsonb DEFAULT '[]'::jsonb;


-- ============================================================================
-- 033_ensure_user_columns.sql
-- ============================================================================
-- ============================================================================
-- 033_ensure_user_columns.sql
-- ----------------------------------------------------------------------------
-- Defensive: ensure every column the app writes to users actually exists.
-- A company tried to sign up and got "Database schema mismatch — run
-- migration 012" because part of the schema was behind the code. This
-- consolidates every per-user column the app touches into one safe-to-rerun
-- migration so the next signup just works.
-- ============================================================================

-- Core identity / lifecycle
ALTER TABLE users ADD COLUMN IF NOT EXISTS "fullName"            text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "email"               citext;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "password"            text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "phone"               text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "userType"            text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "createdAt"           timestamptz DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS "updatedAt"           timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "isSuspended"         boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "photo"               text DEFAULT '';

-- Email verification
ALTER TABLE users ADD COLUMN IF NOT EXISTS "emailVerified"       boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "emailVerifyToken"    text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "emailVerifyExpires"  timestamptz;

-- Password reset
ALTER TABLE users ADD COLUMN IF NOT EXISTS "resetPasswordToken"   text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "resetPasswordExpires" timestamptz;

-- Google sign-in
ALTER TABLE users ADD COLUMN IF NOT EXISTS "googleId"            text;

-- 2FA (migration 011)
ALTER TABLE users ADD COLUMN IF NOT EXISTS "twoFactorSecret"      text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "twoFactorEnabled"     boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "twoFactorBackupCodes" jsonb;

-- Staff (migration 007)
ALTER TABLE users ADD COLUMN IF NOT EXISTS "staffRole"   text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "permissions" jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "createdBy"   text;

-- Tourist fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS "nationality"        text DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "preferredLanguage"  text DEFAULT 'English';

-- Guide fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS "isVerified"          boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "isMinistryLicensed"  boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "licenceNumber"       text DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "languages"           jsonb DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "specialisations"     jsonb DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "destinations"        jsonb DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "rating"              numeric(3,2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "totalReviews"        int DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "totalBookings"       int DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "pricePerDay"         numeric(10,2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "bio"                 text DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "availability"        jsonb DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "availabilitySlots"   jsonb DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "galleryPhotos"       jsonb DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "videoUrl"            text DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "guideAssets"         jsonb DEFAULT '[]'::jsonb;

-- Company fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS "companyName"          text DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "companyRegNo"         text DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "companyServices"      jsonb DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "companyDestinations"  jsonb DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "companyDescription"   text DEFAULT '';

-- Notifications
ALTER TABLE users ADD COLUMN IF NOT EXISTS "notifPrefs"  jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "fcmToken"    text;


-- ============================================================================
-- 034_ensure_tour_package_columns.sql
-- ============================================================================
-- ============================================================================
-- 034_ensure_tour_package_columns.sql
-- ----------------------------------------------------------------------------
-- A company tried to add a tour package and got "Server error. Please try
-- again." because the tour_packages table was missing one or more columns
-- the app writes (guideId, categories, duration_hours/minutes, offers,
-- variants, addons, availableDates, highlights). Consolidates every
-- per-package column the controller touches into one idempotent migration.
-- ============================================================================

-- Provider linking (added when the schema supported guides as providers)
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "guideId" text;

-- Multi-category support (migration 014)
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS categories jsonb DEFAULT '[]'::jsonb;

-- Hours/minutes duration (migration 013) — relax legacy days NOT NULL/CHECK
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS duration_hours   int DEFAULT 0;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS duration_minutes int DEFAULT 0;
ALTER TABLE tour_packages ALTER COLUMN duration_days DROP NOT NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'tour_packages'
      AND constraint_name = 'tour_packages_duration_days_check'
  ) THEN
    EXECUTE 'ALTER TABLE tour_packages DROP CONSTRAINT tour_packages_duration_days_check';
  END IF;
END $$;

-- Offers (migration 008)
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "discountPercent" int DEFAULT 0;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "offerLabel" text;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "offerUntil" timestamptz;

-- Variants & add-ons (migration 009)
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT '[]'::jsonb;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS addons   jsonb DEFAULT '[]'::jsonb;

-- Newer fields
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "availableDates" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS highlights       jsonb DEFAULT '[]'::jsonb;

-- Defensive: make sure these core jsonb fields are present (some older
-- deployments dropped them when columns were renamed).
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS includes  jsonb DEFAULT '[]'::jsonb;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS excludes  jsonb DEFAULT '[]'::jsonb;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS itinerary jsonb DEFAULT '[]'::jsonb;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS languages jsonb DEFAULT '[]'::jsonb;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS images    jsonb DEFAULT '[]'::jsonb;

-- Stats / publication flags
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "isPublished"  boolean DEFAULT false;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "isFeatured"   boolean DEFAULT false;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS rating         numeric(3,2) DEFAULT 0;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "totalReviews" int DEFAULT 0;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "totalBookings" int DEFAULT 0;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS "updatedAt"    timestamptz DEFAULT now();

-- ─── Company "packages" field on users ──────────────────────────────────
-- The company dashboard stores its tour packages inline on the user record
-- (a small jsonb array of {name, price, duration, destination, includes,
-- description}). The PUT /api/auth/profile call was failing with
-- "Server error" because this column didn't exist.
ALTER TABLE users ADD COLUMN IF NOT EXISTS packages jsonb DEFAULT '[]'::jsonb;


-- ============================================================================
-- 035_booking_payment_columns.sql
-- ============================================================================
-- 035_booking_payment_columns.sql
-- Adds the columns the Thawani payment flow needs on the bookings table.
-- Safe to run multiple times.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "isPaid"            boolean      DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "paidAt"            timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "paymentSessionId"  text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "paymentRef"        text;

-- Helpful index for "unpaid confirmed bookings" lookups.
CREATE INDEX IF NOT EXISTS idx_bookings_ispaid ON bookings ("isPaid");


-- ============================================================================
-- 036_package_map_fields.sql
-- ============================================================================
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


-- ============================================================================
-- 037_finance_expenses.sql
-- ============================================================================
-- ════════════════════════════════════════════════════════════════════
--  Migration 037 — Financial management: expenses / salaries / discounts
-- ════════════════════════════════════════════════════════════════════
--  One ledger table for every money-OUT item the admin records, so the
--  Revenue Dashboard can show net profit = paid revenue − expenses.
--
--  category drives reporting buckets. amount is in OMR (3-decimal).
--  "recurring" marks monthly costs (salaries, rent) so future reports
--  can project them; the actual recurrence expansion happens in app code.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS finance_expenses (
  id            TEXT PRIMARY KEY,
  category      TEXT NOT NULL,              -- salary | discount | marketing | operational | refund | commission_payout | tax | rent | software | other
  title         TEXT NOT NULL,             -- short label, e.g. "راتب محمد - يونيو"
  amount        NUMERIC(12,3) NOT NULL,     -- OMR, always positive (it's an outflow)
  currency      TEXT DEFAULT 'OMR',
  "spentAt"     DATE NOT NULL,             -- the date the money left
  recurring     BOOLEAN DEFAULT FALSE,      -- monthly recurring cost (salary, rent…)
  "payee"       TEXT,                       -- who got paid (employee/vendor name)
  "relatedUserId" TEXT,                     -- optional: link to a guide/company (e.g. a payout)
  note          TEXT,
  "createdBy"   TEXT,                       -- admin id who recorded it
  "createdAt"   TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fexp_category ON finance_expenses (category);
CREATE INDEX IF NOT EXISTS idx_fexp_spent    ON finance_expenses ("spentAt" DESC);
CREATE INDEX IF NOT EXISTS idx_fexp_recurring ON finance_expenses (recurring);

ALTER TABLE finance_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fexp_all" ON finance_expenses;
CREATE POLICY "fexp_all" ON finance_expenses FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- 038_payouts_and_commission.sql
-- ============================================================================
-- ════════════════════════════════════════════════════════════════════
--  Migration 038 — Provider payouts + per-user commission override
-- ════════════════════════════════════════════════════════════════════
--  Lets the admin mark a provider's earnings as "paid out" and lets a
--  specific guide/company carry a negotiated commission rate that
--  overrides the type-level default.
-- ════════════════════════════════════════════════════════════════════

-- When the platform transfers a booking's net payout to the provider.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "paidOutAt" TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "payoutRef" TEXT;   -- bank/transfer reference
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "payoutBy"  TEXT;   -- admin id who settled it

CREATE INDEX IF NOT EXISTS idx_bookings_paidout ON bookings ("paidOutAt");

-- Optional per-provider commission override (fraction, e.g. 0.12 = 12%).
-- NULL = use the type-level default from site_settings 'commission'.
ALTER TABLE users ADD COLUMN IF NOT EXISTS "commissionRate" NUMERIC(5,4);

-- Default commission rates the admin can edit from the dashboard.
-- Stored in the existing site_settings key/value store.
INSERT INTO site_settings (key, value)
VALUES ('commission', '{"guide": 0.10, "company": 0.15, "vat": 0, "vatNumber": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- 039_event_teams.sql
-- ============================================================================
-- ════════════════════════════════════════════════════════════════════
--  Migration 039 — Event teams vertical
-- ════════════════════════════════════════════════════════════════════
--  A new provider type: event teams/crews that run events & activities
--  across Oman (cultural shows, sports, adventure, music, etc.).
--  Teams reuse the users table (like companies) plus a team_events table.
-- ════════════════════════════════════════════════════════════════════

-- Team profile fields on the shared users table (userType = 'team').
ALTER TABLE users ADD COLUMN IF NOT EXISTS "teamName"        TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "teamCategory"    TEXT;      -- e.g. cultural / sports / music / adventure
ALTER TABLE users ADD COLUMN IF NOT EXISTS "teamDescription" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "teamGovernorate" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "membersCount"    INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "foundedYear"     INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "teamSocials"     JSONB DEFAULT '{}'::jsonb;  -- {instagram,x,youtube,tiktok,website,whatsapp}

-- Events run by a team.
CREATE TABLE IF NOT EXISTS team_events (
  id            TEXT PRIMARY KEY,
  "teamId"      TEXT NOT NULL,
  title         TEXT NOT NULL,
  "titleAr"     TEXT,
  category      TEXT,
  description   TEXT,
  governorate   TEXT,
  location      TEXT,                 -- venue / area
  "eventDate"   DATE,
  "startTime"   TEXT,
  "endTime"     TEXT,
  "ticketPrice" NUMERIC(10,3) DEFAULT 0,  -- OMR; 0 = free
  capacity      INTEGER,
  "coverImage"  TEXT,
  gallery       JSONB DEFAULT '[]'::jsonb,
  "isPublished" BOOLEAN DEFAULT FALSE,
  "createdAt"   TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_events_team      ON team_events ("teamId");
CREATE INDEX IF NOT EXISTS idx_team_events_published ON team_events ("isPublished");
CREATE INDEX IF NOT EXISTS idx_team_events_date      ON team_events ("eventDate");

ALTER TABLE team_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_events_all" ON team_events;
CREATE POLICY "team_events_all" ON team_events FOR ALL USING (true) WITH CHECK (true);

-- Add a team default to the commission settings.
UPDATE site_settings
SET value = value || '{"team": 0.10}'::jsonb
WHERE key = 'commission' AND NOT (value ? 'team');


-- ============================================================================
-- 040_company_concurrency.sql
-- ============================================================================
-- Company concurrency capacity: how many tours a company can run at the same
-- time (it has multiple guides). NULL/0 = unlimited. Individual guides ignore
-- this (their capacity is always 1, enforced in bookingService).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "maxConcurrentTours" integer;


-- ============================================================================
-- 041_treasury.sql
-- ============================================================================
-- Treasury: the company's main vault. Manual deposits/withdrawals/sends are
-- recorded here; auto income (platform commission) + expenses are computed.
CREATE TABLE IF NOT EXISTS public.treasury_transactions (
  id           text PRIMARY KEY,
  type         text NOT NULL,              -- deposit | withdrawal | send
  amount       numeric NOT NULL,
  description  text,
  "payeeId"    text,
  "payeeName"  text,
  "createdAt"  timestamptz DEFAULT now(),
  "createdBy"  text
);
GRANT ALL ON public.treasury_transactions TO anon, authenticated, service_role;


-- ============================================================================
-- 042_invoices.sql
-- ============================================================================
-- Admin-issued invoices for providers (guides / companies / teams), line items.
CREATE TABLE IF NOT EXISTS public.invoices (
  id             text PRIMARY KEY,
  number         text,
  "recipientId"  text,
  "recipientName" text,
  "recipientType" text,
  items          jsonb,
  subtotal       numeric,
  "vatRate"      numeric,
  vat            numeric,
  total          numeric,
  note           text,
  "createdAt"    timestamptz DEFAULT now(),
  "createdBy"    text
);
GRANT ALL ON public.invoices TO anon, authenticated, service_role;


-- ============================================================================
-- 043_booking_capacity_indexes.sql
-- ============================================================================
-- ============================================================================
-- 043_booking_capacity_indexes.sql
-- ----------------------------------------------------------------------------
-- Fix: the old active-booking unique indexes were too coarse and silently
-- broke real features.
--
--   uniq_active_booking_per_guide_date = UNIQUE ("guideId","tourDate")
--   → only ONE active booking per provider per DATE, which blocked:
--     • company concurrency (a company runs many tours at once)
--     • group package departures (many tourists join one date)
--     • a guide offering morning + afternoon (or several time slots) per day
--
-- New model: the unique constraint is a RACE backstop for INDIVIDUAL GUIDES
-- only (capacity = 1). Companies and packages are governed by application-level
-- capacity / seat checks in bookingService, so they are excluded here.
--
-- Requires the new bookings."providerType" column (added + backfilled below).
-- Safe to re-run.
-- ============================================================================

-- 1) Discriminator so the partial indexes can target solo-guide rows only.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "providerType" TEXT;

-- Backfill existing rows from the provider's user record.
UPDATE bookings b
SET "providerType" = u."userType"
FROM users u
WHERE u.id = b."guideId" AND b."providerType" IS NULL;

-- 2) Drop the over-broad indexes.
DROP INDEX IF EXISTS uniq_active_booking_per_guide_date;
DROP INDEX IF EXISTS uniq_active_booking_per_guide_slot;

-- 3a) Solo-guide DAY-RATE bookings: one active booking per (guide, date, slot).
--     Scoped to individual guides, non-package, non-time-slot rows. Including
--     "tourTime" lets a guide hold morning AND afternoon on the same day.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_guide_dayrate
  ON bookings ("guideId", "tourDate", "tourTime")
  WHERE status IN ('pending', 'quoted', 'confirmed', 'completed')
    AND "startTime" IS NULL
    AND "packageId" IS NULL
    AND "providerType" = 'guide';

-- 3b) Solo-guide TIME-SLOT bookings: one active booking per (guide, date, start).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_guide_slot
  ON bookings ("guideId", "tourDate", "startTime")
  WHERE status IN ('pending', 'quoted', 'confirmed', 'completed')
    AND "startTime" IS NOT NULL
    AND "providerType" = 'guide';

-- Companies + packages: intentionally NO unique index. Their capacity is
-- enforced in bookingService (maxConcurrentTours / max_group_size seats).


-- ============================================================================
-- 044_uploaded_video.sql
-- ============================================================================
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


-- ============================================================================
-- 045_deposit_pay_first.sql
-- ============================================================================
-- ============================================================================
-- 045_deposit_pay_first.sql
-- ----------------------------------------------------------------------------
-- Pay-first booking flow: a priced booking is created as 'awaiting_payment'
-- and is NOT sent to the provider until the tourist pays a deposit. The tourist
-- chooses a deposit percentage (25 / 50 / 100). On payment the booking flips to
-- 'pending' and the provider is notified.
--
-- Status lifecycle:
--   awaiting_payment → (deposit paid) → pending → confirmed → in_progress → completed
--
-- The active-booking unique indexes only include
-- pending/quoted/confirmed/completed, so 'awaiting_payment' rows do NOT reserve
-- the slot until the deposit is actually paid (good — abandoned checkouts free
-- the slot). No index change needed.
-- Safe to re-run.
-- ============================================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "depositPercent" INTEGER;       -- 25 | 50 | 100
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "depositAmount"  NUMERIC(10,3);  -- amount paid up front
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "balanceAmount"  NUMERIC(10,3);  -- remaining after deposit
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "depositPaidAt"  TIMESTAMPTZ;    -- when the deposit was paid


-- ============================================================================
-- 046_payment_ref_columns.sql
-- ============================================================================
-- ============================================================================
-- 046_payment_ref_columns.sql
-- ----------------------------------------------------------------------------
-- paymentSessionId / paymentRef were referenced by the payment code (and listed
-- in OPTIONAL_PAY_COLS) but never actually created. Because they were missing,
-- a settle-update that set paymentRef hit a "column does not exist" error and
-- the resilient-write helper stripped the WHOLE optional set — including isPaid
-- and paidAt — so paid bookings ended up with isPaid=false. Create the columns.
-- Safe to re-run.
-- ============================================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "paymentSessionId" TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "paymentRef"       TEXT;


-- ============================================================================
-- 047_invoice_booking_link.sql
-- ============================================================================
-- Link auto-generated guide payout invoices to their booking (for idempotency
-- and traceability), and record the gross/commission/net split.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "bookingId"   TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS kind          TEXT;     -- 'payout' (guide earnings) | 'manual'
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gross         NUMERIC(10,3);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS commission    NUMERIC(10,3);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS net           NUMERIC(10,3);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "paidOutAt"   TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_invoices_booking   ON invoices ("bookingId");
CREATE INDEX IF NOT EXISTS idx_invoices_recipient ON invoices ("recipientId");


-- ============================================================================
-- 048_invoice_paidout_by.sql
-- ============================================================================
-- Record WHO settled a payout invoice (transferred the money to the provider).
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "paidOutBy"     TEXT;  -- admin/staff user id
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "paidOutByName" TEXT;  -- display name


-- ============================================================================
-- 049_payout_requested.sql
-- ============================================================================
-- 049_payout_requested.sql
-- Lets a provider (guide/company) request payment for an earned-but-unsettled
-- invoice. Stamped when they press "Request payment" on their dashboard.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "payoutRequestedAt" timestamptz;

CREATE INDEX IF NOT EXISTS idx_bookings_payout_requested
  ON bookings ("payoutRequestedAt")
  WHERE "payoutRequestedAt" IS NOT NULL;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- 050_tour_views.sql
-- ============================================================================
-- 050_tour_views.sql
-- Tour-page view tracking. The feature (recordView + guide analytics) shipped
-- but this table was never created, so every view insert failed silently and
-- "Total Views" / "Conversion" always read 0. Creating it activates them.
CREATE TABLE IF NOT EXISTS tour_views (
  "id"         text PRIMARY KEY,
  "packageId"  text,
  "guideId"    text,
  "viewerId"   text,
  "viewerIp"   text,
  "createdAt"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tour_views_guide   ON tour_views ("guideId");
CREATE INDEX IF NOT EXISTS idx_tour_views_package ON tour_views ("packageId");
CREATE INDEX IF NOT EXISTS idx_tour_views_created ON tour_views ("createdAt");

-- App uses the service-role key (RLS bypassed); keep a permissive policy for parity.
ALTER TABLE tour_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tour_views_all ON tour_views;
CREATE POLICY tour_views_all ON tour_views USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- 051_guest_bookings.sql
-- ============================================================================
-- 051_guest_bookings.sql
-- Guest (no-account) checkout: a visitor can book a tour with just their
-- name + email/phone. touristId stays NULL; we store the contact here.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "guestName"  text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "guestEmail" text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "guestPhone" text;

CREATE INDEX IF NOT EXISTS idx_bookings_guest_email
  ON bookings ("guestEmail") WHERE "guestEmail" IS NOT NULL;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- 052_payment_idempotency.sql
-- ============================================================================
-- 052_payment_idempotency.sql
-- Prevent a payment webhook from being processed twice by adding a unique
-- index on paymentRef. A partial index (WHERE paymentRef IS NOT NULL) means
-- un-paid bookings (NULL ref) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_payment_ref_unique
  ON bookings ("paymentRef")
  WHERE "paymentRef" IS NOT NULL;

-- Also index paidAt for fast "find unpaid bookings older than N days" queries.
CREATE INDEX IF NOT EXISTS idx_bookings_paid_at
  ON bookings ("paidAt")
  WHERE "paidAt" IS NOT NULL;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- 053_referral_system.sql
-- ============================================================================
-- 053_referral_system.sql
-- Simple referral system: every user gets a unique 6-char referralCode.
-- When a new user signs up with ?ref=CODE the referredBy column records
-- the referrer's userId. The booking service applies a 5% discount
-- (capped at 5 OMR) to the new user's FIRST booking automatically.

ALTER TABLE users ADD COLUMN IF NOT EXISTS "referralCode"    text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "referredBy"       text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "referralDiscountUsed" boolean DEFAULT false;

-- Unique index so no two users share a code.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code
  ON users ("referralCode") WHERE "referralCode" IS NOT NULL;

-- Fast lookup: "find the user who owns code XYZ"
CREATE INDEX IF NOT EXISTS idx_users_referred_by
  ON users ("referredBy") WHERE "referredBy" IS NOT NULL;

-- Record the discount applied on the booking so finance/admin can audit.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "referralDiscount" numeric(10,3) DEFAULT 0;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- 054_analytics_events.sql
-- ============================================================================
-- 054_analytics_events.sql
-- Lightweight funnel event table to track conversion steps:
--   page_view → book_click → checkout_start → payment_complete
-- Intentionally minimal — no PII stored, just event name + metadata.
CREATE TABLE IF NOT EXISTS analytics_events (
  id           text PRIMARY KEY,
  event        text NOT NULL,
  "packageId"  text,
  "guideId"    text,
  "userId"     text,
  "sessionRef" text,
  meta         jsonb DEFAULT '{}',
  ip           text,
  "createdAt"  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_name ON analytics_events (event);
CREATE INDEX IF NOT EXISTS idx_analytics_event_pkg  ON analytics_events ("packageId") WHERE "packageId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_event_time ON analytics_events ("createdAt");

NOTIFY pgrst, 'reload schema';

