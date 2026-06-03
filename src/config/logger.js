const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  base: { app: 'guideon' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.password_hash',
      '*.resetPasswordToken',
      '*.emailVerifyToken',
      '*.fcm_token',
      '*.STRIPE_SECRET_KEY',
      '*.RESEND_API_KEY',
      '*.OPENAI_API_KEY',
      '*.GROQ_API_KEY',
      '*.OPENROUTER_API_KEY',
      '*.SUPABASE_ANON_KEY',
      '*.SUPABASE_SERVICE_ROLE_KEY',
    ],
    censor: '[REDACTED]',
  },
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,app' },
    },
  }),
});

function httpLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      userId: req.session?.userId || null,
    };
    if (res.statusCode >= 500) logger.error(log, 'request');
    else if (res.statusCode >= 400) logger.warn(log, 'request');
    else logger.info(log, 'request');
  });
  next();
}

module.exports = { logger, httpLogger };
