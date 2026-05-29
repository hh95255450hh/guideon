/**
 * CSRF protection via Origin/Referer header check.
 *
 * Modern browsers send Origin on cross-origin POST/PUT/PATCH/DELETE.
 * Combined with SameSite=strict cookies, this is robust against CSRF.
 *
 * Skips:
 *  - Safe methods (GET, HEAD, OPTIONS)
 *  - Stripe webhook (validates signature instead)
 *  - Requests without a session (public API)
 */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ||
  'http://localhost:3000,https://www.guideon.om,https://www.www.guideon.om,https://guideon-production.up.railway.app')
  .split(',').map(s => s.trim()).filter(Boolean);

const SKIP_PATHS = [
  '/api/payments/webhook',
];

function originAllowed(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return ALLOWED_ORIGINS.some(allowed => {
      try { return new URL(allowed).origin === url.origin; }
      catch { return false; }
    });
  } catch {
    return false;
  }
}

function csrfProtect(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (SKIP_PATHS.some(p => req.path.startsWith(p))) return next();

  const origin = req.headers.origin || req.headers.referer;

  // Same-origin browsers always send Origin on state-changing requests.
  // Missing Origin = either a non-browser client or a CSRF attempt.
  if (!origin) {
    // Allow for API clients (no session = not a logged-in user, not a CSRF risk)
    if (!req.session?.userId) return next();
    return res.status(403).json({ success: false, message: 'CSRF check failed: missing Origin header.' });
  }

  if (!originAllowed(origin)) {
    return res.status(403).json({ success: false, message: `CSRF check failed: origin ${origin} not allowed.` });
  }

  next();
}

module.exports = csrfProtect;
