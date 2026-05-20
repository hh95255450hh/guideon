require('dotenv').config();

const express = require('express');
const session = require('express-session');
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

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:      ["'self'", "https:", "'unsafe-inline'"],
      imgSrc:        ["'self'", "data:", "https:"],
      connectSrc:    ["'self'"],
      fontSrc:       ["'self'", "https:", "data:"],
      objectSrc:     ["'none'"],
      frameAncestors:["'self'"],
    },
  },
}));

app.use(compression());
app.use(morgan('dev'));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'Guideon-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
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

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth',     authRoutes);
app.use('/api/guides',   guideRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews',  reviewRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/trips',    tripRoutes);
app.use('/api/chat',     chatRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'Guideon', timestamp: new Date().toISOString() });
});

app.get(['/search', '/guide-profile', '/login', '/register',
         '/tourist-dashboard', '/guide-dashboard', '/admin', '/plan-trip',
         '/wishlist', '/profile', '/checkout', '/checkout-success', '/offline'], (req, res, next) => {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Guideon running on port ${PORT}`);
});

module.exports = app;
