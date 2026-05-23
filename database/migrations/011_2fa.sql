-- Two-Factor Authentication (TOTP) — for admin and any user who opts in
ALTER TABLE users ADD COLUMN IF NOT EXISTS twoFactorSecret    text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS twoFactorEnabled   boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS twoFactorBackupCodes jsonb;

CREATE INDEX IF NOT EXISTS idx_users_twoFactorEnabled ON users(twoFactorEnabled) WHERE twoFactorEnabled = true;
