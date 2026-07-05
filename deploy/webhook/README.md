# Self-hosted deploy webhook

Auto-deploy that stays entirely inside the Oman Data Park VPS. GitHub only
sends a signed `push` notification — the `git pull` + Docker build all run
locally via `/opt/deploy.sh`.

## How it works

```
git push ──► GitHub ──(signed POST)──► https://guideon.om/deploy-hook
                                           │  (nginx → 172.17.0.1:9000)
                                           ▼
                         guideon-deploy-hook.service (systemd, host)
                             verifies HMAC → runs /opt/deploy.sh
                                            → docker restart guideon-nginx
```

- `deploy-hook.js` — zero-dependency Node listener (HMAC-verified, push→main only).
- `guideon-deploy-hook.service` — systemd unit; reads the secret from
  `/etc/guideon-deploy-hook.env`.
- nginx `location = /deploy-hook` proxies to the host service on port 9000
  (9000 is not opened in the firewall, so it's reachable only via nginx).

## One-time setup (on the server, as root)

```bash
# 1. make sure the repo has this folder (pull once if needed)
cd /opt/guideon && git pull

# 2. run the installer — generates a secret, installs + starts the service
bash /opt/guideon/deploy/webhook/setup.sh

# 3. reload nginx so /deploy-hook starts routing
docker restart guideon-nginx
```

Then in GitHub → repo **Settings → Webhooks → Add webhook**:
- Payload URL: `https://guideon.om/deploy-hook`
- Content type: `application/json`
- Secret: (printed by `setup.sh`)
- Events: **Just the push event**

GitHub will send a `ping`; the service replies `pong` (green check). From then
on every push to `main` deploys automatically.

## Operating it

```bash
systemctl status guideon-deploy-hook          # service state
journalctl -u guideon-deploy-hook -f          # live deploy logs
curl -s http://127.0.0.1:9000/healthz         # idle | deploying
```

Rotate the secret: edit `/etc/guideon-deploy-hook.env`, then
`systemctl restart guideon-deploy-hook`, and update the secret in GitHub.

<!-- deploy webhook smoke test: 2026-07-05T07:29:11Z -->
