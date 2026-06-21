# Server ops (Oman Data Park VPS — 185.64.25.111)

Reference copies of the scripts that run on the production host, so they're
versioned and reproducible. Paths on the server are noted per file.

## Firewall — `docker-block.sh`  → `/opt/firewall/docker-block.sh`
Docker publishes some internal ports on `0.0.0.0` and **bypasses UFW** (it writes
its own iptables rules). This script blocks EXTERNAL access to the Postgres
pooler (5432, 6543) and Kong (8000, 8443) in the `DOCKER-USER` chain while
allowing localhost + the Docker bridge nets. Re-applied at boot by
`guideon-firewall.service` (oneshot, `After=docker.service`).

Verify: from outside the VPS only 22/80/443 should answer.

## Backup — `guideon-backup.sh`  → `/opt/backups/guideon-backup.sh`
Daily at 02:30 (`/etc/cron.d/guideon-backup`). Dumps the app data (`public` +
`storage` schemas) AND tars the uploaded files (guide/package/message images
from the storage volume). Keeps 14 days.

> ⚠️ **Offsite gap:** backups live in `/opt/backups` on the SAME VPS. If the
> server is lost, the backups go with it. Add an offsite copy (rclone to S3 /
> Backblaze B2 / Google Drive, or scp to another host) — see the cron stub idea
> at the bottom of `guideon-backup.sh`.

## Docker log rotation — `daemon.json`  → `/etc/docker/daemon.json`
Caps each container log at 10 MB × 3 files so logs can't fill the disk. Applies
to containers on their next (re)create.

## TLS — certbot
Auto-renew daily at 03:00 (`/etc/cron.d/guideon-certbot`): `certbot renew` then
`nginx -s reload`.
