# Guideon — Tourist Guide Booking System in Oman

**GIS5005 – Developing Quality Software and Systems II | PRAC 1**

A web-based platform connecting tourists visiting Oman with certified, Ministry-licensed local guides.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Bootstrap 5, JavaScript |
| Backend | Node.js, Express.js |
| Data Storage | JSON flat files (users.json, bookings.json, reviews.json) |
| Authentication | express-session + bcryptjs |

---

## Getting Started

```bash
npm install
npm start
```

Open: **http://localhost:3000**

---

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Tourist | tourist@example.com | Password123! |
| Guide | mohammed@Guideon.om | Password123! |
| Admin | admin@Guideon.om | Admin123! |

---

## System Pages

| Page | URL |
|---|---|
| Homepage | `/` |
| Search Guides | `/search.html` |
| Guide Profile | `/guide-profile.html?id=guide-001` |
| Login | `/login.html` |
| Register | `/register.html` |
| Tourist Dashboard | `/tourist-dashboard.html` |
| Guide Dashboard | `/guide-dashboard.html` |
| Admin Dashboard | `/admin.html` |

---

## API Endpoints

### Auth
- `POST /api/auth/register` — Register tourist or guide
- `POST /api/auth/login` — Login
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Get current user

### Guides
- `GET /api/guides` — Search guides (query: destination, language, date, minRating, sortBy)
- `GET /api/guides/top` — Top 3 rated guides
- `GET /api/guides/:id` — Guide profile + reviews
- `PUT /api/guides/me/availability` — Update availability (guide only)

### Bookings
- `POST /api/bookings` — Create booking (tourist only)
- `GET /api/bookings/mine` — Tourist's bookings
- `GET /api/bookings/guide` — Guide's bookings
- `PATCH /api/bookings/:id/status` — Accept/Reject/Cancel

### Reviews
- `POST /api/reviews` — Submit review (tourist, completed tours only)
- `GET /api/reviews/guide/:guideId` — Guide's reviews

### Admin
- `GET /api/admin/stats` — Platform statistics
- `GET /api/admin/guides/pending` — Pending guide approvals
- `PATCH /api/admin/guides/:id/verify` — Verify guide
- `PATCH /api/admin/users/:id/suspend` — Suspend user

---

## User Roles

**Tourist** — Search guides, book, cancel (48hr policy), write reviews

**Guide** — Manage availability calendar, accept/reject bookings, view earnings

**Admin** — Verify guide licences, suspend accounts, view all data
