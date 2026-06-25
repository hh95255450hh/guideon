#!/usr/bin/env bash
# ============================================================================
# Guideon CUTOVER — run AFTER DNS A record guideon.om -> 185.64.25.111
# Issues HTTPS cert, rewrites image URLs to guideon.om, points the app at the
# public domain, and brings up nginx. Safe to re-run.
# Usage:  bash /opt/cutover.sh
# ============================================================================
set -e
DOMAIN=guideon.om
EMAIL=hh92hh@guideon.om
OLD=https://uwgkszszsogivhphlfdy.supabase.co
NEW=https://guideon.om
cd /opt/guideon/deploy

echo "== 0. verify DNS points here =="
RESOLVED=$(getent hosts $DOMAIN | awk '{print $1}' | head -1)
echo "guideon.om resolves to: ${RESOLVED:-<none>} (this server = 185.64.25.111)"
if [ "$RESOLVED" != "185.64.25.111" ]; then
  echo "!! DNS not pointing here yet. Aborting. Switch the A record first."; exit 1
fi

echo "== 1. free port 80 (remove temp nginx) =="
docker rm -f gd-nginx-test 2>/dev/null || true

echo "== 2. issue Let's Encrypt certificate (standalone) =="
mkdir -p certbot/conf certbot/www
docker run --rm -p 80:80 \
  -v "$PWD/certbot/conf:/etc/letsencrypt" \
  certbot/certbot certonly --standalone \
  -d "$DOMAIN" -d "www.$DOMAIN" \
  --non-interactive --agree-tos -m "$EMAIL"

echo "== 3. rewrite stored image URLs (cloud -> guideon.om) =="
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=0 <<SQL
DO \$\$
DECLARE r record; old text := '$OLD'; new text := '$NEW';
BEGIN
  FOR r IN SELECT table_name, column_name, data_type FROM information_schema.columns
           WHERE table_schema='public' AND data_type IN ('text','character varying','json','jsonb','ARRAY') LOOP
    BEGIN
      EXECUTE format('UPDATE public.%I SET %I = replace(%I::text, %L, %L)::%s WHERE %I::text LIKE %L',
        r.table_name, r.column_name, r.column_name, old, new,
        CASE WHEN r.data_type=''ARRAY'' THEN ''text[]'' ELSE r.data_type END,
        r.column_name, '%'||old||'%');
    EXCEPTION WHEN others THEN RAISE NOTICE 'skip %.%: %', r.table_name, r.column_name, SQLERRM;
    END;
  END LOOP;
END\$\$;
SQL
echo "url rewrite done"

echo "== 4. point app at public domain for new uploads =="
sed -i "s#^SUPABASE_URL=.*#SUPABASE_URL=$NEW#" .env
grep "^SUPABASE_URL=" .env

echo "== 5. bring up app + nginx (HTTPS) =="
docker compose up -d --build 2>&1 | tail -8

echo "== 6. setup cert auto-renew (cron, twice daily) =="
cat > /etc/cron.d/guideon-certbot <<CRON
0 0,12 * * * root cd /opt/guideon/deploy && docker run --rm -v "\$PWD/certbot/conf:/etc/letsencrypt" certbot/certbot renew --quiet && docker compose restart nginx
CRON

echo "== 7. verify =="
sleep 8
for u in / /api/stats/public; do
  code=$(curl -sk -o /dev/null -w "%{http_code}" "https://$DOMAIN$u")
  echo "https://$DOMAIN$u -> $code"
done
echo "CUTOVER COMPLETE. Open https://$DOMAIN"
