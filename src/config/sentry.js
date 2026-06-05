/**
 * Sentry — error tracking helpers.
 *
 * Initialization now happens in src/instrument.js (required first, before
 * express). This module only wires the Express error handler and exposes
 * capture helpers.
 *
 * Usage in app.js:
 *   require('./instrument');                 // FIRST line, before express
 *   const express = require('express');
 *   ...
 *   const sentry = require('./config/sentry');
 *   // ... routes ...
 *   sentry.setupErrorHandler(app);           // after routes, before custom error handler
 */
let Sentry = null;
const enabled = !!process.env.SENTRY_DSN;

if (enabled) {
  try { Sentry = require('@sentry/node'); } catch (_) { Sentry = null; }
}

// Kept for backwards compatibility (no-op init — real init is in instrument.js)
function init(_app) { /* initialization moved to instrument.js */ }

function setupErrorHandler(app) {
  if (!Sentry || !app) return;
  try {
    Sentry.setupExpressErrorHandler(app);
    console.log('[Sentry] Express error handler attached.');
  } catch (err) {
    console.warn('[Sentry] Failed to attach error handler:', err.message);
  }
}

function captureException(err, context) {
  if (!Sentry) return;
  Sentry.captureException(err, { extra: context });
}

function captureMessage(msg, level = 'info') {
  if (!Sentry) return;
  Sentry.captureMessage(msg, level);
}

module.exports = { init, setupErrorHandler, captureException, captureMessage };
