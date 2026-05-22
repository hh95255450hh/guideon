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

// Legacy /health endpoint kept for compatibility
router.get('/', (req, res) => {
  res.json({ status: 'ok', app: 'Guideon', timestamp: new Date().toISOString() });
});

module.exports = router;
