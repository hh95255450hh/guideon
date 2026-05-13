require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const { errorHandler, notFound } = require('./middleware/errorHandler');

// ─── Route imports ────────────────────────────────────────────────────────────
const authRoutes      = require('./routes/auth');
const tourRoutes      = require('./routes/tours');
const bookingRoutes   = require('./routes/bookings');
const paymentRoutes   = require('./routes/payments');
const reviewRoutes    = require('./routes/reviews');
const userRoutes      = require('./routes/users');
const companyRoutes   = require('./routes/companies');
const chatRoutes      = require('./routes/chat');

const app = express();

// ─── Security & Utility Middleware ────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts, please try again later' },
});
app.use('/api/', limiter);
app.use('/api/auth', authLimiter);

// ─── Raw body for Stripe webhooks (must come BEFORE express.json) ─────────────
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// ─── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Static files ─────────────────────────────────────────────────────────────
app.use('/uploads', express.static('uploads'));
app.use(express.static('public'));          // serves index.html at /

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// ─── API Overview ─────────────────────────────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({
    name: 'OmanExplorer API',
    version: '1.0.0',
    endpoints: {
      auth:      '/api/auth',
      tours:     '/api/tours',
      companies: '/api/companies',
      bookings:  '/api/bookings',
      payments:  '/api/payments',
      reviews:   '/api/reviews',
      users:     '/api/users',
    },
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/tours',     tourRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/bookings',  bookingRoutes);
app.use('/api/payments',  paymentRoutes);
app.use('/api/reviews',   reviewRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/chat',      chatRoutes);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`OmanExplorer API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
