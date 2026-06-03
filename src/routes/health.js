const router = require('express').Router();
const supabase = require('../config/supabase');

const startTime = Date.now();

// Liveness — is the process running?
router.get('/live', (req, res) => {
  res.json({ status: 'ok', uptime_seconds: Math.floor((Date.now() - startTime) / 1000) });
});

// Readiness — can the app serve traffic? (DB reachable)
router.get('/ready', async (req, res) => {
  try {
    const { error } = await supabase.from('users').select('id', { head: true, count: 'exact' }).limit(1);
    if (error) throw error;
    res.json({ status: 'ready', db: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'not_ready', db: 'unreachable', error: err.message });
  }
});

// Lightweight metrics — process stats
router.get('/metrics', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    memory: {
      rss_mb:       Math.round(mem.rss / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      heap_total_mb:Math.round(mem.heapTotal / 1024 / 1024),
    },
    node_version: process.version,
    env: process.env.NODE_ENV || 'development',
  });
});

// Key diagnostic — confirms WHICH Supabase key the server is configured with,
// without ever revealing the key itself (only presence + a short, safe prefix).
router.get('/keycheck', (req, res) => {
  const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anon = process.env.SUPABASE_ANON_KEY || '';
  const active = svc || anon;
  res.json({
    serviceRoleKeyPresent: !!svc,
    serviceRolePrefix: svc ? svc.slice(0, 10) : null,   // e.g. "sb_secret_"
    anonKeyPresent: !!anon,
    usingKey: svc ? 'service_role' : (anon ? 'anon' : 'none'),
    activeKeyPrefix: active ? active.slice(0, 10) : null,
  });
});

// Legacy /health endpoint kept for compatibility
router.get('/', (req, res) => {
  res.json({ status: 'ok', app: 'Guideon', timestamp: new Date().toISOString() });
});

module.exports = router;
