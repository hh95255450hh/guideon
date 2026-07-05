const rateLimit = require('express-rate-limit');

// All limits are configurable via environment variables — change in the ODP .env
// without redeploying code. Set RATE_LIMIT_DISABLED=true to disable everything
// (useful during launch / promotions). Defaults are sensible production values.
const DISABLED = process.env.RATE_LIMIT_DISABLED === 'true';
const num = (key, fallback) => {
  const v = parseInt(process.env[key], 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

// Helper to skip when globally disabled
const skip = () => DISABLED;

const loginLimiter = rateLimit({
  windowMs: num('RATE_LIMIT_LOGIN_WINDOW_MIN', 15) * 60 * 1000,
  max: num('RATE_LIMIT_LOGIN_MAX', 10),
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip,
});

const registerLimiter = rateLimit({
  windowMs: num('RATE_LIMIT_REGISTER_WINDOW_MIN', 60) * 60 * 1000,
  max: num('RATE_LIMIT_REGISTER_MAX', 20),
  message: { success: false, message: 'Too many accounts created from this network. Please try again later or contact support.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip,
});

const passwordResetLimiter = rateLimit({
  windowMs: num('RATE_LIMIT_RESET_WINDOW_MIN', 60) * 60 * 1000,
  max: num('RATE_LIMIT_RESET_MAX', 10),
  message: { success: false, message: 'Too many password reset requests. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip,
});

const apiLimiter = rateLimit({
  windowMs: num('RATE_LIMIT_API_WINDOW_SEC', 60) * 1000,
  max: num('RATE_LIMIT_API_MAX', 100),
  message: { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip,
});

const chatLimiter = rateLimit({
  windowMs: num('RATE_LIMIT_CHAT_WINDOW_SEC', 60) * 1000,
  max: num('RATE_LIMIT_CHAT_MAX', 20),
  message: { success: false, message: 'Too many chat messages. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip,
});

// Guest checkout is a public financial endpoint — keep tight to prevent
// spam bookings that exhaust the email quota and pollute the DB.
const guestCheckoutLimiter = rateLimit({
  windowMs: num('RATE_LIMIT_GUEST_CHECKOUT_WINDOW_MIN', 10) * 60 * 1000,
  max: num('RATE_LIMIT_GUEST_CHECKOUT_MAX', 5),
  message: { success: false, message: 'عدد كبير من المحاولات. حاول بعد 10 دقائق · Too many attempts. Please wait 10 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skip,
});

if (DISABLED) {
  console.warn('[rateLimit] DISABLED via RATE_LIMIT_DISABLED=true — all limits bypassed.');
}

module.exports = { loginLimiter, registerLimiter, passwordResetLimiter, apiLimiter, chatLimiter, guestCheckoutLimiter };
