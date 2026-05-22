# Guideon — Tourism Marketplace for Oman

منصة حجز المرشدين السياحيين والشركات المعتمدة في سلطنة عُمان.

🌐 **Live:** https://guideon-production.up.railway.app
🌐 **Domain:** https://guideon.guide

---

## Stack

- **Backend:** Node.js 18+ · Express 4
- **Database:** Supabase (PostgreSQL)
- **Sessions:** connect-pg-simple (Postgres-backed)
- **Auth:** express-session + bcryptjs
- **Payments:** Stripe Checkout + webhooks
- **Email:** Resend
- **AI Chatbot:** OpenAI GPT-4o-mini (with local KB fallback)
- **Storage:** Supabase Storage (avatars, gallery)
- **Push:** Firebase Admin
- **Frontend:** Vanilla JS + Bootstrap 5 (RTL/LTR) + PWA
- **Logging:** pino + Sentry
- **Validation:** express-validator
- **Rate Limiting:** express-rate-limit

---

## Quick Start

```bash
git clone https://github.com/hh95255450hh/guideon
cd guideon
npm install
cp .env.example .env       # then fill in real keys
npm run migrate            # apply database migrations
npm run dev                # http://localhost:3000
```

### Required env vars

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | ✅ | from Supabase project settings |
| `SUPABASE_ANON_KEY` | ✅ | from Supabase API settings |
| `DATABASE_URL` | ✅ | Postgres connection string (for session store) |
| `SESSION_SECRET` | ✅ | random ≥32 chars |
| `RESEND_API_KEY` | recommended | emails skipped if missing |
| `STRIPE_SECRET_KEY` | for payments | starts with `sk_` |
| `STRIPE_WEBHOOK_SECRET` | for payments | starts with `whsec_` |
| `OPENAI_API_KEY` | for AI chat | local KB used if missing |
| `SENTRY_DSN` | recommended | error tracking |
| `CORS_ORIGINS` | optional | comma-separated allowed origins |
| `APP_URL` | optional | defaults to localhost:3000 |

---

## Database Migrations

Run SQL files in `database/migrations/` in order on your Supabase SQL editor:

1. `001_add_fcm_token.sql` — FCM push token column
2. `002_booking_unique_constraint.sql` — prevent double-booking same date
3. `003_performance_indexes.sql` — indexes for production performance

---

## API Reference

All endpoints under `/api/`. Responses follow `{ success: bool, message?, ...data }`.

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Register tourist/guide/company |
| POST | `/login` | — | Login (rate-limited) |
| POST | `/logout` | session | Destroy session |
| GET  | `/me` | session | Current user |
| PUT  | `/profile` | session | Update profile fields |
| PUT  | `/change-password` | session | Change password |
| POST | `/upload-photo` | session | Avatar upload (Supabase Storage) |
| POST | `/forgot-password` | rate-limit | Email reset link |
| POST | `/reset-password` | rate-limit | Submit new password with token |
| GET  | `/verify-email/:token` | — | Confirm email link |
| POST | `/resend-verification` | rate-limit | Re-send verification |
| POST | `/fcm-token` | session | Save FCM token |

### Guides — `/api/guides`

| Method | Path | Description |
|---|---|---|
| GET  | `/` | Search (destination, language, date, minRating, minPrice, maxPrice, sortBy) |
| GET  | `/top` | Top 3 rated verified guides |
| GET  | `/:id` | Profile + reviews |
| PUT  | `/me/availability` | Update own availability (guide only) |
| PUT  | `/me/profile` | Update own bio/price/destinations |

### Bookings — `/api/bookings`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST   | `/` | tourist | Create booking |
| GET    | `/mine` | tourist | My bookings |
| GET    | `/guide` | guide | Bookings as guide |
| GET    | `/all` | admin | All bookings |
| PATCH  | `/:id/status` | session | confirmed / cancelled / completed |

### Payments — `/api/payments`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/create-checkout` | session | Stripe checkout session |
| GET  | `/status/:bookingId` | session | Payment status |
| POST | `/webhook` | Stripe signature | (mounted in app.js, raw body) |
| POST | `/refund` | admin | Note refund request |

### Reviews — `/api/reviews`
- `POST /` — submit review (tourist, completed booking only)
- `GET /:guideId` — guide reviews

### Trips — `/api/trips`
- `POST /` — tourist posts trip request
- `GET /mine` — tourist's own requests
- `GET /matching` — requests matching a guide
- `GET /all` — admin
- `PATCH /:id/close` — close own request

### Chat — `/api/chat`
- `POST /` — AI chatbot (GPT-4o-mini or local KB)

### Messages — `/api/messages`
- `POST /` — send message
- `GET /conversations` — list conversations
- `GET /thread/:otherId` — message thread
- `GET /unread-count` — unread total

### Upload — `/api/upload`
- `POST /photo` — profile photo
- `POST /gallery` — add gallery photo (max 8)
- `DELETE /gallery` — remove gallery photo
- `POST /video` — set YouTube video URL

### Admin — `/api/admin` (admin only)
- `GET /stats` · `/guides/pending` · `/guides` · `/tourists` · `/companies/pending` · `/companies` · `/bookings`
- `PATCH /guides/:id/verify` · `/companies/:id/verify` · `/users/:id/suspend` · `/users/:id/unsuspend` · `/bookings/:id/complete`

### Health — `/health`
- `GET /live` — liveness
- `GET /ready` — readiness (DB ping)
- `GET /metrics` — uptime + memory
- `GET /` — legacy health

---

## Security

- Sessions: `httpOnly` + `secure` in prod + `SameSite=strict`
- Passwords: bcrypt cost 10
- CSRF: Origin/Referer check on state-changing requests
- Rate limits: 5/15min login · 3/h register · 3/h password reset · 100/min global · 20/min chat
- CORS: whitelisted via `CORS_ORIGINS`
- Helmet: CSP, no-sniff, frame-ancestors
- Stripe webhooks: signature verified with raw body

---

## Testing

```bash
npm test           # node:test unit tests
npm run lint       # syntax check
```

---

## Deployment

- **Railway:** auto-deploys from `main` branch
- **Required env vars:** see table above
- **Health check path:** `/health/ready`
- **PORT:** Railway injects; defaults to 3000

---

## License

Proprietary © 2026 Guideon.
