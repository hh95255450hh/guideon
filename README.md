# Guideon — Tourism Marketplace for Oman

منصة حجز المرشدين السياحيين والشركات المعتمدة في سلطنة عُمان.

🌐 **Live:** https://guideon.om

Operated by **Vision for Digital Thought** (D-U-N-S 850403864), Seeb, Muscat.

---

## Stack

- **Backend:** Node.js 18+ · Express 4
- **Database / Storage:** self-hosted **Supabase** (PostgreSQL + Storage). The app
  uses the **service-role key**, so it **bypasses RLS** — authorization is
  enforced entirely in application code.
- **Sessions:** Postgres-backed (`connect-pg-simple`) or a Supabase-backed store;
  `MemoryStore` only as a last-resort fallback.
- **Auth:** express-session + bcryptjs
- **Payments:** **Paymob** (Oman, LIVE) via Unified Checkout / Intention API +
  HMAC callback; **Thawani** fallback (amounts in *baisa* = OMR×1000). Selected
  by the `PAYMENT_PROVIDER` env var. Gated by `PAYMENTS_ENABLED`. **No Stripe.**
- **Email:** Resend (bilingual AR/EN templates)
- **AI:** **Claude API** (`@anthropic-ai/sdk`, `claude-opus-4-8`) — trip planner,
  matchmaking, copywriting, review summaries. Falls back to a local KB when the
  key is missing.
- **Push:** Firebase Admin (FCM V1) + VAPID web push
- **Frontend:** Vanilla JS + Bootstrap 5 (RTL/LTR) + PWA (no build step)
- **Mobile:** Flutter app in `mobile/` (Provider, Dio+CookieJar; native
  `flutter_map` explore screen + WebView for booking flows). Built via Codemagic.
- **Logging:** pino + Sentry (optional)
- **Rate Limiting:** express-rate-limit

---

## Quick Start

```bash
git clone https://github.com/hh95255450hh/guideon
cd guideon
npm install
cp .env.example .env       # then fill in real keys
# Apply DB schema manually — see "Database Migrations" below (no npm run migrate)
npm run dev                # http://localhost:3000
npm test                   # node --test test/*.test.js  (no DB needed)
```

> **Note:** `npm run migrate` / `scripts/migrate.js` is legacy and non-functional
> (it references a `database/schema.sql` that no longer exists). Apply migrations
> manually in the Supabase SQL editor as described below.

### Required env vars

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | ✅ | e.g. `https://guideon.om` (routes to Kong) or the project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | service-role key — the app's DB client |
| `DATABASE_URL` | ✅ | Postgres connection string (session store) |
| `SESSION_SECRET` | ✅ | random ≥32 chars (fails fast in prod if missing) |
| `PAYMENTS_ENABLED` | for payments | `true` to enable the Pay-Now flow |
| `PAYMENT_PROVIDER` | for payments | `paymob` (LIVE) or `thawani` |
| `PAYMOB_SECRET_KEY` / `PAYMOB_PUBLIC_KEY` / `PAYMOB_INTEGRATION_ID` / `PAYMOB_HMAC_SECRET` | for Paymob | LIVE keys start with `omn_sk_l…` |
| `THAWANI_*` (`SECRET_KEY`, `PUBLISHABLE_KEY`, `MODE`) | for Thawani fallback | `MODE=uat` or `live` |
| `RESEND_API_KEY` / `EMAIL_FROM` | recommended | emails skipped if missing |
| `ANTHROPIC_API_KEY` | for AI | local KB used if missing |
| `FIREBASE_SERVICE_ACCOUNT` | for mobile push | base64-encoded service-account JSON |
| `WHATSAPP_ENABLED` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN` | for WhatsApp | notifications via Meta Cloud API |
| `SENTRY_DSN` | optional | error tracking |
| `CORS_ORIGINS` | optional | comma-separated allowed origins |
| `APP_URL` | optional | defaults to `http://localhost:3000` |

See `.env.example` for the full list.

---

## Database Migrations

Numbered SQL files live in `database/migrations/` (`001` … `054`). They are applied
**manually in the Supabase SQL editor**, in order. There is no automated runner and
no applied-migrations tracking table, so track which are applied out-of-band.

⚠️ **`ALL_MIGRATIONS.sql` is stale** — it only contains `001–005`. Do not rely on it
as the complete schema; apply the individual numbered files.

New tables/columns require a new numbered migration; controllers that write optional
columns use a "drop unknown column and retry" pattern so a not-yet-applied migration
doesn't break the whole save.

---

## API Reference

All endpoints under `/api/`. Responses follow `{ success: bool, message?, ...data }`.
Routers are wired in `src/app.js`.

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Register tourist/guide/company |
| POST | `/login` | — | Login (rate-limited) |
| POST | `/logout` | session | Destroy session |
| GET  | `/me` | session | Current user |
| PUT  | `/profile` | session | Update profile (field-whitelisted) |
| PUT  | `/change-password` | session | Change password |
| POST | `/upload-photo` | session | Avatar upload (Supabase Storage) |
| POST | `/forgot-password` · `/reset-password` · `/resend-verification` | rate-limit | Password / verification flows |
| GET  | `/verify-email/:token` | — | Confirm email link |
| POST | `/fcm-token` | session | Save FCM token |

### Guides — `/api/guides`

| Method | Path | Description |
|---|---|---|
| GET  | `/` | Search (destination, governorate, language, date, specialisation, rating, price, sortBy) |
| GET  | `/top` | Top featured verified guides |
| GET  | `/:id` | Profile + reviews (contact fields stripped for non-owners) |
| PUT  | `/me/availability` · `/me/profile` | Update own availability / profile (guide only) |

### Bookings — `/api/bookings`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST   | `/` | tourist | Create booking |
| GET    | `/mine` · `/guide` | tourist / guide | My bookings |
| GET    | `/all` | admin | All bookings |
| PATCH  | `/:id/status` | session | confirmed / cancelled / completed (ownership-checked) |
| PATCH  | `/:id/quote` | guide | Set a custom quote |

### Payments — `/api/payments` (Paymob / Thawani)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET  | `/feature-status` | — | Whether Pay-Now is enabled + active gateway |
| POST | `/guest-checkout` | rate-limit | Book + pay without an account |
| POST | `/create-checkout` | session | Start a checkout (Paymob intention / Thawani session) |
| GET  | `/verify` | session | Verify a Thawani session server-side |
| GET  | `/status/:bookingId` | session | Payment status (ownership-checked) |
| POST | `/refund` | admin | Note a refund request |
| POST | `/paymob/callback` | HMAC | Paymob webhook (mounted before CSRF, raw body) |
| POST | `/webhook` | verified | Thawani webhook (re-fetches session) |

Webhooks never trust the payload: the booking ref comes from the verified
session/HMAC, amounts are checked against what's owed, and settlement is idempotent
(unique `paymentRef` index + in-memory guard).

### Reviews — `/api/reviews`
- `POST /` — submit review (tourist, completed booking only; photo URLs validated)
- `GET /:guideId` — guide reviews · `PATCH /:reviewId/reply` — guide reply

### Other routers
`/api/trips`, `/api/chat` (Claude AI + KB), `/api/messages`, `/api/upload`,
`/api/packages`, `/api/companies`, `/api/teams`, `/api/notifications`,
`/api/wishlist`, `/api/ai`, `/api/2fa`, `/api/qa`, `/api/stats`,
`/api/site-settings`, `/api/content`, `/api/admin` (admin/staff only).

### Health — `/health`
`/live` (liveness) · `/ready` (DB ping) · `/metrics` (uptime + memory) · `/` (legacy)

---

## Security

- Sessions: `httpOnly` + `secure` in prod + `SameSite=lax`
- Passwords: bcrypt
- CSRF: Origin/Referer check on state-changing requests
- Authorization: **app-only** (service-role bypasses RLS) — every mutating
  endpoint checks `req.session.userId` ownership; profile updates use explicit
  field whitelists (no `req.body` spread)
- Output sanitization: public guide views strip contact fields
  (`sanitizeContact`); user content is escaped with `gdEsc()` / URLs with
  `gdSafeUrl()` on the client
- Uploads: content-type from an extension allow-list (not client mimetype);
  SVG forced to octet-stream
- Rate limits: login / register / password-reset / global / chat / guest-checkout
- Helmet: CSP, no-sniff, frame-ancestors
- Payment webhooks: Paymob HMAC (timing-safe) / Thawani session re-fetch

---

## Deployment

- **Host:** Oman Data Park VPS (`185.64.25.111`), Docker Compose
  (`guideon-app` + `guideon-nginx`); self-hosted Supabase (Kong on port 8000)
  on the same server. **Railway is not used.**
- **Deploy:** SSH in and run `bash /opt/deploy.sh` (git pull + `docker compose up
  --build` + `docker restart guideon-nginx`).
- **Env vars:** `/opt/guideon/deploy/.env`; rotate secrets via
  `/opt/rotate-secret.sh VAR`.
- **Health check path:** `/health/ready`

---

## License

Proprietary © 2026 Guideon.
