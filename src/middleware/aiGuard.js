// Cost and abuse guard for the AI endpoints.
//
// Every call to /api/ai spends real money on the Claude API, and the trip
// planner and matchmaker are open to anonymous visitors on purpose — they are
// how a first-time tourist discovers guides. Before this guard, the only limit
// was 12 requests a minute per IP, with no cap on input size (the JSON parser
// accepts 10 MB): one IP could make over 17,000 calls a day, each stuffed with
// as much text as it liked.
//
// Three limits, all cheap and in-process (the app runs as a single instance):
//   1. Input size  — the body and each free-text field have a hard ceiling.
//   2. Daily quota — per signed-in user, or per IP for anonymous visitors.
//   3. Circuit breaker — a platform-wide daily ceiling, so no combination of
//      users and IPs can run the bill past a known amount.
// Counters reset at midnight Oman time.

const MAX_BODY_BYTES = 32 * 1024;
const MAX_FIELD_CHARS = 1500;

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const LIMITS = {
  anonPerDay: () => num(process.env.AI_DAILY_PER_IP, 8),
  userPerDay: () => num(process.env.AI_DAILY_PER_USER, 40),
  globalPerDay: () => num(process.env.AI_DAILY_GLOBAL, 2000),
};

// Oman is UTC+4 with no daylight saving.
const omanDay = (now = Date.now()) => new Date(now + 4 * 3600e3).toISOString().slice(0, 10);

const state = { day: omanDay(), global: 0, perKey: new Map() };
function rollover(now) {
  const d = omanDay(now);
  if (d !== state.day) { state.day = d; state.global = 0; state.perKey.clear(); }
}

const msg = (en, ar) => `${en} — ${ar}`;

function tooLarge(req) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > MAX_BODY_BYTES) return true;
  const body = req.body;
  if (!body || typeof body !== 'object') return false;
  if (JSON.stringify(body).length > MAX_BODY_BYTES) return true;
  return Object.values(body).some(v => typeof v === 'string' && v.length > MAX_FIELD_CHARS);
}

function aiGuard(req, res, next) {
  if (tooLarge(req)) {
    return res.status(413).json({ success: false,
      message: msg(`Please keep your request under ${MAX_FIELD_CHARS} characters.`, `اختصر طلبك إلى أقل من ${MAX_FIELD_CHARS} حرف.`) });
  }

  const now = Date.now();
  rollover(now);

  if (state.global >= LIMITS.globalPerDay()) {
    console.warn(`[ai-guard] global daily ceiling reached (${state.global})`);
    return res.status(503).json({ success: false,
      message: msg('The AI assistant is resting for today. Please try again tomorrow.', 'المساعد الذكي متوقف لليوم، حاول غداً.') });
  }

  const userId = req.session && req.session.userId;
  const key = userId ? `u:${userId}` : `ip:${req.ip}`;
  const limit = userId ? LIMITS.userPerDay() : LIMITS.anonPerDay();
  const used = state.perKey.get(key) || 0;
  if (used >= limit) {
    return res.status(429).json({ success: false,
      message: userId
        ? msg('You have used today’s AI requests. Please come back tomorrow.', 'استهلكت طلبات الذكاء الاصطناعي لهذا اليوم، عد غداً.')
        : msg('Sign in to keep planning with AI today.', 'سجّل الدخول لمواصلة التخطيط بالذكاء الاصطناعي اليوم.') });
  }

  state.perKey.set(key, used + 1);
  state.global += 1;
  next();
}

module.exports = { aiGuard, MAX_BODY_BYTES, MAX_FIELD_CHARS, _state: state, _rollover: rollover, _omanDay: omanDay };
