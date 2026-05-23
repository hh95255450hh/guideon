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
