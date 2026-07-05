#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# One-time setup for the Guideon self-hosted deploy webhook.
# Run ONCE on the Oman Data Park VPS as root, AFTER the repo has been pulled
# so /opt/guideon/deploy/webhook/ exists:
#
#     bash /opt/guideon/deploy/webhook/setup.sh
#
# It: generates a shared secret (if missing), installs the systemd service,
# and prints the secret + webhook URL to configure in GitHub.
# Re-running is safe (idempotent) — it keeps an existing secret.
# ═══════════════════════════════════════════════════════════════════════════
set -e

ENV_FILE=/etc/guideon-deploy-hook.env
UNIT_SRC=/opt/guideon/deploy/webhook/guideon-deploy-hook.service
UNIT_DST=/etc/systemd/system/guideon-deploy-hook.service

if [ ! -f "$ENV_FILE" ]; then
  SECRET=$(openssl rand -hex 32)
  printf 'DEPLOY_HOOK_SECRET=%s\nDEPLOY_HOOK_PORT=9000\nDEPLOY_HOOK_BRANCH=main\n' "$SECRET" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "== generated new secret in $ENV_FILE =="
else
  echo "== keeping existing secret in $ENV_FILE =="
fi

cp "$UNIT_SRC" "$UNIT_DST"
systemctl daemon-reload
systemctl enable guideon-deploy-hook
systemctl restart guideon-deploy-hook
sleep 1
systemctl --no-pager --full status guideon-deploy-hook | head -n 8 || true

echo
echo "════════════════════════════════════════════════════════════════════"
echo " Configure this GitHub webhook (Settings → Webhooks → Add webhook):"
echo "   Payload URL : https://guideon.om/deploy-hook"
echo "   Content type: application/json"
echo "   Events      : Just the push event"
echo "   Secret      : $(grep -oP '(?<=DEPLOY_HOOK_SECRET=).*' "$ENV_FILE")"
echo "════════════════════════════════════════════════════════════════════"
echo " Health check (local): curl -s http://127.0.0.1:9000/healthz"
echo " Live logs:  journalctl -u guideon-deploy-hook -f"
