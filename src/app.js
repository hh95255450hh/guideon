// Sentry must be initialized BEFORE express is required (v8 auto-instrumentation).
require('./instrument');
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const MemoryStore = require('memorystore')(session);
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');

const authRoutes    = require('./routes/auth');
const guideRoutes   = require('./routes/guides');
const bookingRoutes = require('./routes/bookings');
const reviewRoutes  = require('./routes/reviews');
const adminRoutes   = require('./routes/admin');
const tripRoutes    = require('./routes/trips');
const chatRoutes    = require('./routes/chat');
const paymentRoutes = require('./routes/payments');
const uploadRoutes   = require('./routes/upload');
const messagesRoutes = require('./routes/messages');
const packageRoutes  = require('./routes/packages');

const app = express();
const sentry = require('./config/sentry');

app.set('trust proxy', 1);

// Stripe webhook needs raw body — register BEFORE express.json()
app.post('/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  require('./controllers/paymentController').webhook
);

// Paymob server-to-server callback — register BEFORE the /api CSRF (Origin)
// check, since Paymob's servers don't send a same-origin Origin header. The
// handler verifies the Paymob HMAC itself, so it doesn't need CSRF.
app.post('/api/payments/paymob/callback',
  express.json(),
  require('./controllers/paymentController').paymobCallback
);

app.use(helmet({
  // Allow cross-origin popups (e.g. Google Sign-In) to communicate back via postMessage
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  // HSTS — tell browsers to always use HTTPS for guideon.om for a year
  // (with subdomains). Safe because Railway redirects http→https.
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  // Stop browsers from MIME-sniffing JSON/JS as HTML (XSS escape vector)
  noSniff: true,
  // Don't leak full URLs to other origins (privacy + token leak protection)
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Block Flash/other plugin embeds entirely
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://accounts.google.com", "https://accounts.google.com/gsi/client"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:      ["'self'", "https:", "'unsafe-inline'"],
      imgSrc:        ["'self'", "data:", "https:", "https://upload.wikimedia.org"],
      mediaSrc:      ["'self'", "https:", "data:", "blob:"],
      connectSrc:    ["'self'", "https://api.qrserver.com", "https://accounts.google.com", "https://oauth2.googleapis.com", "https://www.googleapis.com", "https://nominatim.openstreetmap.org", "https://*.tile.openstreetmap.org"],
      fontSrc:       ["'self'", "https:", "data:"],
      objectSrc:     ["'none'"],
      frameSrc:      ["'self'", "https://www.youtube.com", "https://accounts.google.com", "https://accounts.google.com/gsi/"],
      frameAncestors:["'self'"],
    },
  },
}));

const { logger, httpLogger } = require('./config/logger');
app.use(compression());
if (process.env.NODE_ENV === 'production') {
  app.use(httpLogger);
} else {
  app.use(morgan('dev'));
}

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,https://guideon.om,https://www.guideon.om,https://guideon.guide,https://www.guideon.guide,https://guideon-production.up.railway.app')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Don't throw — that becomes a 500. Just disable CORS headers; the browser will block it.
    return cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session store
// Note: Supabase Postgres direct (port 5432) is IPv6-only and unreachable from Railway.
// Set USE_PG_SESSIONS=true ONLY if DATABASE_URL points to the Supabase Pooler (port 6543).
let sessionStore;
const usePgSessions = process.env.USE_PG_SESSIONS === 'true' && !!process.env.DATABASE_URL;
try {
  if (usePgSessions) {
    const sessionPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      connectionTimeoutMillis: 5000,
    });
    sessionPool.on('error', (err) => console.error('[SessionPool] error:', err.message));
    sessionStore = new pgSession({
      pool: sessionPool,
      tableName: 'user_sessions',
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 60,
    });
    console.log('[Session] Using Postgres session store.');
  } else if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    // Persistent sessions via Supabase (no DB connection string needed).
    // Requires the app_sessions table (migration 025).
    const SupabaseStore = require('./config/supabaseSessionStore')(session);
    sessionStore = new SupabaseStore();
    console.log('[Session] Using Supabase session store.');
  } else {
    throw new Error('Using in-memory store (no session backend configured)');
  }
} catch (e) {
  console.warn(`[Session] ${e.message}.`);
  sessionStore = new MemoryStore({ checkPeriod: 86400000 });
}

// Session secret MUST be set in production. A known default would let anyone
// forge signed session cookies (account/admin takeover). Fail fast instead
// of starting with a public fallback that silently puts us at risk.
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('[SECURITY] FATAL: SESSION_SECRET is not set. Refusing to start in production with a default secret.');
  process.exit(1);
}
// Outside production, generate an ephemeral random secret per boot so we
// never ship a hardcoded one. Sessions reset on dev restart — acceptable.
const SESSION_SECRET = process.env.SESSION_SECRET
  || require('crypto').randomBytes(48).toString('hex');

app.use(session({
  store: sessionStore,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

// Local HTML, CSS, JS — never HTTP-cache so browser always gets the latest version
// Smart caching: HTML must always re-check (otherwise a deploy never
// reaches users), but CSS/JS/static assets carry cache-busted ?v= query
// strings (e.g. style.css?v=40), so they can — and should — be cached
// hard. Browsers will still pull the new file when ?v= bumps.
//
// Before this change every request to /, /css/*, /js/* set no-store →
// returning visitors re-downloaded ~140 KB of CSS+JS every page view.
// Now the second page view costs essentially zero bytes.
// HTML must always re-check (otherwise a new deploy never reaches users).
// CSS/JS/images all carry cache-busted ?v= query strings, so caching them
// hard is safe: when the version bumps the URL changes. Setting these via
// express.static's setHeaders option (below) is the only reliable way —
// a separate middleware gets overwritten by static's own header logic.
app.use((req, res, next) => {
  const p = req.path;
  if (p.endsWith('.html') || p === '/') {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

// Inject per-entity SEO meta (OG/Twitter) for shared guide/tour links — must
// run BEFORE express.static so scrapers get server-rendered tags.
app.use(require('./middleware/seoMeta'));

// Programmatic SEO landing pages (/tour-guides/:place, /tours/:category).
// Before express.static so the clean URLs resolve; unknown slugs call next()
// and fall through to static/404.
app.use(require('./routes/seoLanding'));

// Public invoice verification page (QR target on guide invoices).
app.get('/invoice/verify/:token', require('./controllers/accountingController').verify);

app.use(express.static(path.join(__dirname, '..', 'public'), {
  dotfiles: 'allow', // serve /.well-known/assetlinks.json for TWA / Play Store
  setHeaders: (res, filePath) => {
    // HTML re-check rule is handled by the middleware above; here we only
    // need to mark versioned static assets as long-cacheable. .html falling
    // through to static (rare) keeps the no-store header from above.
    if (/\.(css|js|woff2?|ttf|otf|eot|webp|png|jpe?g|gif|svg|ico|mp4|webm|json)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

const { apiLimiter, chatLimiter } = require('./middleware/rateLimit');
const csrfProtect = require('./middleware/csrf');
const { loadUser } = require('./middleware/auth');
// Mobile-app meta (version gate + crash sink) — public + CSRF-exempt (the app
// sends no Origin). Mounted BEFORE csrf so it isn't rejected.
app.use('/api/app', apiLimiter, require('./routes/appMeta'));
app.use('/api/', apiLimiter);
app.use('/api/', csrfProtect);
app.use('/api/', loadUser);
app.use('/api/chat', chatLimiter);

app.use('/api/auth',     authRoutes);
app.use('/api/2fa',      require('./routes/twoFactor'));
app.use('/api/guides',   guideRoutes);
app.use('/api/companies', require('./routes/companies'));
app.use('/api/teams',    require('./routes/teams'));
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews',  reviewRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/trips',    tripRoutes);
app.use('/api/chat',     chatRoutes);
app.use('/api/ai',       require('./routes/ai'));
app.use('/api/payments', paymentRoutes);
app.use('/api/upload',   uploadRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/site-settings', require('./routes/siteSettings'));
app.use('/api/content', require('./routes/content'));
app.use('/api/stats',    require('./routes/stats'));
app.use('/api',          require('./routes/guideAnalytics'));
app.use('/api/qa', require('./routes/qa'));
app.use('/api', require('./routes/extras'));

app.use('/health', require('./routes/health'));
app.use('/', require('./routes/seo'));

app.get(['/search', '/guide-profile', '/login', '/register',
         '/tourist-dashboard', '/guide-dashboard', '/company-dashboard', '/admin', '/plan-trip',
         '/wishlist', '/profile', '/checkout', '/checkout-success', '/offline',
         '/forgot-password', '/reset-password',
         '/tour-package', '/shared-wishlist', '/qr', '/two-factor',
         '/terms', '/privacy', '/faq', '/how-it-works',
         '/regions', '/region', '/trails', '/blog', '/blog-post', '/cancellation',
         '/admin-homepage'], (req, res, next) => {
  res.sendFile(path.join(__dirname, '..', 'public', req.path.replace('/', '') + '.html'), err => {
    if (err) next();
  });
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API endpoint not found.' });
  }
  res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
});

// Sentry Express error handler — must be AFTER routes, BEFORE the custom handler.
sentry.setupErrorHandler(app);

// Global error handler — must be LAST
app.use((err, req, res, next) => {
  logger.error({ err, path: req.path, method: req.method }, 'unhandled error');
  sentry.captureException(err, { path: req.path, method: req.method, userId: req.session?.userId });
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Server error.' : err.message,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Guideon running on port ${PORT}`);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException');
  setTimeout(() => process.exit(1), 1000);
});

module.exports = app;
