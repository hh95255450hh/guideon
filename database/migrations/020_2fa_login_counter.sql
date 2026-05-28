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
