# GUIDEON — Project Guide for Claude Code

> This file is auto-loaded every session. It gives you (Claude) instant,
> full context on the project so you don't have to re-derive it. Keep it
> updated when architecture or conventions change.

## What this is

**Guideon** (guideon.om) is Oman's tour-guide marketplace: tourists discover,
book, message, and pay licensed local **guides** and registered tourism
**companies** across the Sultanate. Commission-per-booking model (no
subscriptions). Operated by **Vision for Digital Thought** (D-U-N-S 850403864),
a registered Omani sole proprietorship in Seeb, Muscat.

User-facing roles: **tourist**, **guide**, **company**, **admin/staff**.

## Communication

The owner (Haitham) communicates in **Arabic** and wants **direct action** —
implement fully when asked, don't just advise. Reply in Arabic. User-facing
strings in the product are bilingual **Arabic + English**.

## Stack

- **Backend:** Node.js + Express (`src/app.js` is the entry). Session auth
  (express-session), helmet, compression, express-rate-limit, CSRF via Origin
  check, Pino logging, Sentry (optional).
- **DB/Storage:** **Supabase** (Postgres + Storage). The app uses the
  **service-role key** as its DB client (`src/config/supabase.js`), so it
  **bypasses RLS** — all RLS policies are `USING(true)` and **authorization
  is enforced entirely in application code**. A missed ownership check = full
  data exposure. Be careful in any new endpoint.
- **Frontend:** vanilla JS + Bootstrap 5 + custom CSS in `public/`. No build
  step, no framework. Pages are plain `.html` files; shared logic in
  `public/js/*.js`. Charts use ApexCharts via CDN.
- **Payments:** **Thawani** (Oman gateway, amounts in *baisa* = OMR×1000).
  Currently in "free launch" mode (`PAYMENTS_ENABLED` gates it). `stripe` and
  `openai` are in package.json but **not the active providers** — do not
  reintroduce Stripe; payment = Thawani. AI uses the Claude API when built.
- **Hosting:** **Railway** (single instance), auto-deploys on push to `main`.
  **Deploys take ~1–4 minutes** — after pushing, wait before telling the user
  to check; HTML is served `no-store` so a hard refresh shows the new version.
- **i18n:** `public/js/i18n.js` is a ~6KB lazy loader; per-language packs live
  in `public/i18n/<code>.json` (10 languages). Bump `PACK_VERSION` in i18n.js
  **and** the `i18n.js?vNN` query in all HTML when pack content changes (packs
  are served immutable-cached).

## Run / test / deploy

```bash
node src/app.js          # run locally on PORT (needs SUPABASE_* env to hit DB)
npm test                 # node --test test/*.test.js  (no DB needed; 55 tests)
git add -A && git commit && git push   # Railway auto-deploys main
```

- Local `npm test` has **no database** — it can't catch data-shape bugs.
  Anything that changes a DB query path **must be verified against live
  production data** (curl https://guideon.om/...). See the findPage pitfall.
- Commit messages end with the Co-Authored-By trailer. Branch off `main` only
  if asked; the owner typically wants direct pushes to `main`.

## Conventions & hard-won gotchas

- **Never put a literal `{}` in a `sed` replacement run via `find … -exec sed …
  {} \;`** — `find` substitutes its `{}` placeholder (the filename) into the
  WHOLE command, including your replacement text, corrupting code (it once
  turned `catch(e){}` into `catch(e)<filepath>` in every page's `<head>`).
  Use a Node script to edit many files, or a `for` loop, instead.
- **i18n pages: when you change `public/i18n/*.json`, bump `PACK_VERSION` in
  `i18n.js` AND the `i18n.js?vNN` query in every HTML** (packs are immutable-
  cached). Same for any `?vNN` asset (polish.css/js, common-widgets.js).
- **`common-widgets.js` is loaded on most pages and injects the global polish
  layer (`polish.css`/`polish.js`) + unified nav + widgets.** Bump its `?vNN`
  when you change it.
- **Never use `SupabaseDB.findPage()` for guide search or admin user lists.**
  Its `.order()` + `count:'exact'` + `.range()` pushdown **returned 0 rows on
  production** and took the platform down. Use `findAllWhere(eq)` / `readAll()`
  then filter/sort/paginate in JS (current scale is small). This is the single
  most important gotcha.
- **`isSuspended: false` in an eq filter excludes NULL rows** — guides without
  the column set vanish. Prefer JS filtering for boolean "not suspended".
- **Authorization is app-only** (service-role bypasses RLS). Every mutating
  endpoint must check `req.session.userId` ownership. Profile updates use
  explicit field **whitelists** — never spread `req.body` (prevents userType/
  isVerified/rating self-escalation). Keep it that way.
- **Message `attachmentUrl` must be https or site-relative** — it's rendered in
  `<a href>`; a `javascript:`/`data:` scheme is stored XSS. Validated in
  `messagesController.send` + `gdSafeUrl` on the client.
- **Uploads:** stored filenames are UUIDs; content-type is derived from an
  extension allow-list (`storageService.uploadBuffer`), never the client
  mimetype (blocks HTML/JS/SVG from serving as markup).
- **User-facing errors must be friendly + bilingual.** Log technical detail
  (column errors, "run migration NN") to the server; never show it to users.
- **XSS:** use `window.gdEsc()` for any user content in innerHTML and
  `window.gdSafeUrl()` for URLs (both in `public/js/common-widgets.js`).
- **Resilient writes:** several controllers insert/update then drop unknown
  columns and retry, so a not-yet-run migration on one field doesn't break the
  whole save. Follow that pattern for new optional columns.
- **New DB tables/columns need a numbered migration** in
  `database/migrations/NNN_*.sql` that the **owner runs manually in the
  Supabase SQL editor** (Claude can't touch the live DB). Tell them clearly.

## Key directories

- `src/controllers/` — one per domain (auth, booking, guide, messages,
  payment, admin, package, review, trip, wishlist, notifications, …).
- `src/services/` — bookingService, emailService (Resend, bilingual templates),
  storageService (Sharp WebP compression), seoLanding (programmatic SEO),
  thawani, platformContext, auditService.
- `src/routes/` — express routers; `seo.js` builds sitemap.xml,
  `seoLanding.js` serves `/tour-guides/:place` + `/tours/:category`.
- `src/middleware/` — auth (requireLogin/requireGuide/requireAdmin/permissions),
  csrf, rateLimit, seoMeta (server-rendered OG tags for shared links).
- `src/config/permissions.js` — admin/staff RBAC (ROLES + PERMISSIONS).
- `public/` — all frontend pages + assets. Dashboards: tourist/guide/company/
  admin. `public/js/gd-messages.js` is the shared chat engine for all 3
  dashboards. `public/admin-revenue.html` is the finance dashboard.
- `database/migrations/` — 38+ numbered SQL files. Highest applied may lag.
- `android/` — Bubblewrap TWA config + build guide for the Play Store app.
- `Guideon_Info.md` — owner-facing changelog/credentials doc; **update it and
  push after every significant change** (owner preference).

## Current status (as of 2026-06-13)

Live and working. Recent work this period:
- Perf: hard-cache versioned assets, lazy-load i18n per language, single
  Bootstrap direction per page, lazy-load search card photos.
- Refactor: unified dashboard chat into `gd-messages.js`.
- Admin **Revenue Dashboard** + **financial management** (expenses/salaries/
  net profit) — needs migration 037 (`finance_expenses`) run in Supabase.
- Legal pages (about/privacy/terms/contact) with the legal entity + DUNS.
- Security: fixed stored-XSS via attachment URL; hardened upload content-type.
- Guide **analytics** (charts) + per-guide endpoint `/api/guides/me/analytics`.
- **Programmatic SEO**: `/tour-guides/:place` and `/tours/:category` landing
  pages in the sitemap (submitted to Google Search Console).
- Android **TWA** config ready (`android/`), needs a JDK+Android-SDK machine
  to run `bubblewrap build`.
- Tests: 55 passing (`test/*.test.js`).

Open follow-ups / ideas: AI Trip Planner (Claude API), WhatsApp booking,
escrow payments. Architectural (defer until scale): real RLS, Redis for SSE/
cache, DB indexing.
