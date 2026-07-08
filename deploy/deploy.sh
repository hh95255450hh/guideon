#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# GUIDEON resilient deploy  (lives at /opt/deploy.sh on the ODP VPS)
# ---------------------------------------------------------------------------
# Called by the deploy webhook and by manual `bash /opt/deploy.sh`.
#
# Why this exists: the old one-liner `docker compose up -d --build` failed
# SILENTLY when `npm ci` hit a transient registry hiccup (exit 146) — git pull
# had already succeeded, the build aborted, the OLD container kept running, and
# nobody was told. Deploys looked green but served stale code.
#
# This version:
#   1. Retries the image build up to 3x (rides out transient npm/network fails).
#   2. Recreates the container from the fresh image and verifies the site is
#      actually serving HTTP 200 afterwards.
#   3. Emails ADMIN_EMAIL via Resend on ANY failure — never fails silently.
# Keep a copy in the repo (deploy/deploy.sh) in sync with /opt/deploy.sh.
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail   # deliberately NOT -e: we handle each failure and alert.

REPO=/opt/guideon
TAG='== Guideon Deploy =='

# Load ONLY the Resend creds we need. We do NOT `source` .env: bash chokes on
# unquoted values that contain spaces or <> — e.g. EMAIL_FROM=Guideon
# <noreply@guideon.om> is a syntax error that aborts sourcing and would leave
# RESEND_API_KEY unset, silently breaking the very alerts we rely on.
_env() { grep -E "^$1=" "$REPO/deploy/.env" 2>/dev/null | head -1 | cut -d= -f2-; }
RESEND_API_KEY=$(_env RESEND_API_KEY)
EMAIL_FROM=$(_env EMAIL_FROM)
ADMIN_EMAIL=$(_env ADMIN_EMAIL)
# Alert recipients: prefer ADMIN_ALERT_EMAIL (comma-separated list, matches the
# app's emailService convention) so deploy alerts can fan out to several inboxes
# (e.g. a reliable hotmail + the official admin@guideon.om). Falls back to
# ADMIN_EMAIL, then a hard default.
ADMIN_ALERT_EMAIL=$(_env ADMIN_ALERT_EMAIL)

# alert "subject" "body"  — best-effort email; never blocks the deploy.
# Sends ONE message PER recipient. Critical: Resend suppresses the ENTIRE
# message if ANY single "to" address is on its suppression list — so bundling a
# suppressed address (e.g. admin@guideon.om) together with a good one (hotmail)
# would silently drop the alert for BOTH. Separate sends isolate each address so
# a healthy inbox always gets the alert regardless of the others.
alert() {
  [ -z "${RESEND_API_KEY:-}" ] && { echo "!! alert (no RESEND key): $1"; return 0; }
  local from="${EMAIL_FROM:-Guideon <noreply@guideon.om>}"
  local recips="${ADMIN_ALERT_EMAIL:-${ADMIN_EMAIL:-admin@guideon.om}}"
  local addr payload oldIFS="$IFS"
  IFS=','
  for addr in $recips; do
    addr="$(printf '%s' "$addr" | tr -d '[:space:]')"   # trim
    [ -z "$addr" ] && continue
    if command -v jq >/dev/null 2>&1; then
      payload=$(jq -n --arg f "$from" --arg t "$addr" --arg s "$1" --arg b "$2" \
        '{from:$f,to:[$t],subject:$s,text:$b}')
    else
      payload=$(printf '{"from":"%s","to":"%s","subject":"%s","text":"%s"}' \
        "$from" "$addr" "$1" "$2")
    fi
    curl -s --max-time 15 -X POST https://api.resend.com/emails \
      -H "Authorization: Bearer $RESEND_API_KEY" \
      -H "Content-Type: application/json" -d "$payload" >/dev/null 2>&1 || true
  done
  IFS="$oldIFS"
}

echo "$TAG start $(date -u +%FT%TZ)"
cd "$REPO" || { echo "FATAL: $REPO missing"; exit 1; }

BEFORE=$(git rev-parse --short HEAD 2>/dev/null || echo '?')
if ! git pull origin main; then
  alert "🔴 Guideon deploy FAILED (git pull)" "git pull origin main failed on the VPS. Site unchanged (was $BEFORE)."
  echo "$TAG git pull FAILED"; exit 1
fi
AFTER=$(git rev-parse --short HEAD 2>/dev/null || echo '?')
echo "commit $BEFORE -> $AFTER"

cd "$REPO/deploy" || { echo "FATAL: deploy dir missing"; exit 1; }

# ── 1. Build the image, retrying transient failures (npm ci exit 146 etc.) ──
BUILD_OK=0
for i in 1 2 3; do
  echo ">> build attempt $i/3"
  if docker compose build app; then BUILD_OK=1; break; fi
  echo ">> build attempt $i failed"
  [ "$i" -lt 3 ] && { echo ">> retrying in 15s..."; sleep 15; }
done
if [ "$BUILD_OK" -ne 1 ]; then
  alert "🔴 Guideon deploy FAILED (build ×3)" \
        "docker compose build failed 3 times for commit $AFTER. The OLD container is still running (stale code live). Manual rebuild needed: ssh in, cd /opt/guideon/deploy, docker compose build app."
  echo "$TAG BUILD FAILED after 3 attempts"; exit 1
fi

# ── 2. Recreate the container from the freshly built image ──
# Retry: overlapping deploys can leave a stale container ref, so `up -d` throws
# a transient "No such container" that resolves on a second attempt.
UP_OK=0
for i in 1 2 3; do
  if docker compose up -d; then UP_OK=1; break; fi
  echo ">> up -d attempt $i failed"
  [ "$i" -lt 3 ] && { echo ">> retrying in 8s..."; sleep 8; }
done
if [ "$UP_OK" -ne 1 ]; then
  alert "🔴 Guideon deploy FAILED (up -d ×3)" "docker compose up -d failed 3 times for commit $AFTER after a successful build."
  echo "$TAG up -d FAILED"; exit 1
fi
# git pull creates new inodes nginx must remount.
docker restart guideon-nginx >/dev/null 2>&1 || true
sleep 6

# ── 3. Verify the site actually serves, or shout about it ──
CODE=$(curl -sS -o /dev/null -w '%{http_code}' https://guideon.om --max-time 15 || echo 000)
if [ "$CODE" != "200" ]; then
  alert "🔴 Guideon deploy UNHEALTHY" "After deploying commit $AFTER the site returned HTTP $CODE (expected 200). Check: docker ps, docker logs guideon-app."
  echo "$TAG UNHEALTHY: HTTP $CODE"; exit 1
fi

echo "$TAG Done — commit $AFTER live, site HTTP $CODE"
