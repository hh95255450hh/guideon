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
