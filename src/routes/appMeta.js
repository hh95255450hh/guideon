/**
 * Mobile-app support endpoints (public, CSRF-exempt — the app has no Origin):
 *   GET  /api/app/version  → force-update gate (min/latest build numbers).
 *   POST /api/app/error    → crash/error sink → server logs (+ Sentry if set).
 */
const router = require('express').Router();

let logger; try { logger = require('../config/logger'); } catch { logger = null; }
let Sentry;  try { Sentry = require('@sentry/node'); } catch { Sentry = null; }

const STORE_URL =
  'https://play.google.com/store/apps/details?id=om.guideon.guideon';

// ── Version gate ──────────────────────────────────────────────────────────
// Driven by env so you can force an update without a redeploy:
//   APP_MIN_BUILD    = builds below this MUST update (blocking).
//   APP_LATEST_BUILD = newest build available (optional "update available").
router.get('/version', (_req, res) => {
  res.json({
    minBuild: parseInt(process.env.APP_MIN_BUILD || '0', 10) || 0,
    latestBuild: parseInt(process.env.APP_LATEST_BUILD || '0', 10) || 0,
    storeUrl: STORE_URL,
    message: 'يتوفّر تحديث جديد لتطبيق Guideon — يُرجى التحديث للمتابعة.\n'
      + 'A new version of the Guideon app is required. Please update.',
  });
});

// ── Crash / error sink ────────────────────────────────────────────────────
router.post('/error', (req, res) => {
  try {
    const b = req.body || {};
    const info = {
      message: String(b.message || '').slice(0, 2000),
      platform: String(b.platform || '').slice(0, 40),
      appVersion: String(b.appVersion || '').slice(0, 40),
      stack: String(b.stack || '').slice(0, 4000),
    };
    if (logger && logger.error) logger.error({ mobileCrash: info }, 'mobile app error');
    else console.error('[mobile app error]', info.platform, info.appVersion, info.message);
    if (Sentry && Sentry.captureMessage) {
      Sentry.captureMessage(`[mobile ${info.platform} ${info.appVersion}] ${info.message}`, {
        level: 'error',
        extra: { stack: info.stack },
      });
    }
  } catch (_) { /* never fail the client */ }
  res.json({ ok: true });
});

module.exports = router;
