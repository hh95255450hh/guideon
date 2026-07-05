#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   GUIDEON self-hosted deploy webhook
   ---------------------------------------------------------------------------
   Runs ON the Oman Data Park VPS as a systemd service. Listens on a LOCAL
   port; nginx proxies POST https://guideon.om/deploy-hook -> here. When GitHub
   sends a verified `push` to `main`, it runs /opt/deploy.sh and restarts nginx.

   Nothing leaves the server: GitHub only POSTs a signed notification; the
   git pull + docker build all happen locally via deploy.sh.

   Config via env (set in the systemd unit):
     DEPLOY_HOOK_SECRET   shared HMAC secret (same value configured in GitHub)
     DEPLOY_HOOK_PORT     listen port (default 9000)
     DEPLOY_HOOK_BRANCH   branch to deploy on (default "main")
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const http = require('http');
const crypto = require('crypto');
const { execFile } = require('child_process');

const SECRET = process.env.DEPLOY_HOOK_SECRET || '';
const PORT   = parseInt(process.env.DEPLOY_HOOK_PORT || '9000', 10);
const BRANCH = process.env.DEPLOY_HOOK_BRANCH || 'main';

if (!SECRET) {
  console.error('[deploy-hook] FATAL: DEPLOY_HOOK_SECRET is not set. Refusing to start.');
  process.exit(1);
}

let deploying = false;

function log(...a) { console.log(new Date().toISOString(), '[deploy-hook]', ...a); }

// Timing-safe compare of the GitHub signature against our own HMAC of the body.
function verify(sig, body) {
  if (!sig) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function runDeploy() {
  deploying = true;
  log('deploy started');
  // Mirror the proven manual sequence: conclude any leftover merge, then
  // deploy.sh (git pull + docker compose build), then remount nginx.
  const cmd = 'cd /opt/guideon && (git commit --no-edit 2>/dev/null || true) && '
            + 'bash /opt/deploy.sh && docker restart guideon-nginx';
  execFile('/bin/bash', ['-lc', cmd], { timeout: 20 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 },
    (err, stdout, stderr) => {
      deploying = false;
      if (stdout) log('stdout:\n' + stdout.trim());
      if (stderr) log('stderr:\n' + stderr.trim());
      if (err) log('deploy FAILED:', err.message);
      else log('deploy finished OK');
    });
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end(deploying ? 'deploying\n' : 'idle\n');
  }
  if (req.method !== 'POST') { res.writeHead(405); return res.end('method not allowed\n'); }

  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > 5 * 1024 * 1024) { req.destroy(); return; }   // cap payload at 5MB
    chunks.push(c);
  });
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    if (!verify(req.headers['x-hub-signature-256'], body)) {
      log('rejected: bad signature from', req.socket.remoteAddress);
      res.writeHead(401); return res.end('bad signature\n');
    }
    const event = req.headers['x-github-event'];
    if (event === 'ping') { res.writeHead(200); return res.end('pong\n'); }
    if (event !== 'push') { res.writeHead(204); return res.end(); }

    let payload;
    try { payload = JSON.parse(body.toString('utf8')); }
    catch { res.writeHead(400); return res.end('bad json\n'); }

    if (payload.ref !== 'refs/heads/' + BRANCH) {
      log('ignored push to', payload.ref);
      res.writeHead(200); return res.end('ignored (not ' + BRANCH + ')\n');
    }
    if (deploying) {
      log('deploy already in progress; queued push ignored');
      res.writeHead(200); return res.end('already deploying\n');
    }
    res.writeHead(202); res.end('accepted\n');
    runDeploy();
  });
});

server.listen(PORT, '0.0.0.0', () => log('listening on :' + PORT + ' (branch=' + BRANCH + ')'));
