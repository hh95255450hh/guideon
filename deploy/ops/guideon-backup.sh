#!/usr/bin/env bash
set -e
TS=$(date +%F-%H%M)
DIR=/opt/backups
# Database: app data (public) + storage object metadata (storage schema)
docker exec supabase-db pg_dump -U postgres -d postgres -Fc --no-owner --no-acl \
  -n public -n storage > "$DIR/guideon-db-$TS.dump"
# Uploaded files (guide/package/message images) — the actual objects
if [ -d /opt/supabase/docker/volumes/storage ]; then
  tar czf "$DIR/guideon-storage-$TS.tar.gz" -C /opt/supabase/docker/volumes/storage . 2>/dev/null || true
fi
# Retention: keep 14 days
find "$DIR" -name 'guideon-db-*.dump'       -mtime +14 -delete
find "$DIR" -name 'guideon-storage-*.tar.gz' -mtime +14 -delete
echo "backup done @ $TS (db + storage)"
