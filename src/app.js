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
sentry.init(app);

app.set('trust proxy', 1);

// Stripe webhook needs raw body — register BEFORE express.json()
app.post('/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  require('./controllers/paymentController').webhook
);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:      ["'self'", "https:", "'unsafe-inline'"],
      imgSrc:        ["'self'", "data:", "https:", "https://upload.wikimedia.org"],
      connectSrc:    ["'self'", "https://api.qrserver.com"],
      fontSrc:       ["'self'", "https:", "data:"],
      objectSrc:     ["'none'"],
      frameSrc:      ["'self'", "https://www.youtube.com"],
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

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'Guideon-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

// Local HTML, CSS, JS — never HTTP-cache so browser always gets the latest version
app.use((req, res, next) => {
  if (/\.(html|css|js)$/.test(req.path) || req.path === '/') {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public'), {
  dotfiles: 'allow', // serve /.well-known/assetlinks.json for TWA / Play Store
}));

const { apiLimiter, chatLimiter } = require('./middleware/rateLimit');
const csrfProtect = require('./middleware/csrf');
const { loadUser } = require('./middleware/auth');
app.use('/api/', apiLimiter);
app.use('/api/', csrfProtect);
app.use('/api/', loadUser);
app.use('/api/chat', chatLimiter);

app.use('/api/auth',     authRoutes);
app.use('/api/2fa',      require('./routes/twoFactor'));
app.use('/api/guides',   guideRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews',  reviewRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/trips',    tripRoutes);
app.use('/api/chat',     chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/upload',   uploadRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/site-settings', require('./routes/siteSettings'));
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
