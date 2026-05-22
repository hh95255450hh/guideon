/**
 * Sentry — error tracking.
 *
 * Only initialized if SENTRY_DSN is set in env.
 * Get free DSN at https://sentry.io/ (5K errors/month free).
 *
 * Usage in app.js:
 *   const sentry = require('./config/sentry');
 *   sentry.init(app);                       // before routes
 *   // ... routes ...
 *   sentry.errorHandler(app);               // after routes, before custom error handler
 */
let Sentry = null;
let initialized = false;

function init(app) {
  if (!process.env.SENTRY_DSN) {
    console.log('[Sentry] SENTRY_DSN not set — error tracking disabled.');
    return;
  }
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      integrations: [
        Sentry.httpIntegration(),
        Sentry.expressIntegration(),
      ],
    });
    Sentry.setupExpressErrorHandler(app);
    initialized = true;
    console.log('[Sentry] Initialized.');
  } catch (err) {
    console.warn('[Sentry] Failed to initialize:', err.message);
  }
}

function captureException(err, context) {
  if (!initialized || !Sentry) return;
  Sentry.captureException(err, { extra: context });
}

function captureMessage(msg, level = 'info') {
  if (!initialized || !Sentry) return;
  Sentry.captureMessage(msg, level);
}

module.exports = { init, captureException, captureMessage };
