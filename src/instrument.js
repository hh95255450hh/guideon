/**
 * Sentry instrumentation — MUST be required at the very top of app.js,
 * BEFORE express and any other module is imported. Sentry v8 auto-instruments
 * http/express by patching them at require-time, so it has to run first.
 *
 * No-op if SENTRY_DSN is not set.
 */
require('dotenv').config();

if (process.env.SENTRY_DSN) {
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
    console.log('[Sentry] Initialized (instrument.js).');
  } catch (err) {
    console.warn('[Sentry] Failed to initialize:', err.message);
  }
} else {
  console.log('[Sentry] SENTRY_DSN not set — error tracking disabled.');
}
