# OmanExplorer – Tourism Marketplace API

A production-ready Node.js + PostgreSQL backend for the OmanExplorer tourism marketplace platform.

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Runtime     | Node.js 18+                         |
| Framework   | Express.js                          |
| Database    | PostgreSQL 14+                      |
| Auth        | JWT (access + refresh tokens)       |
| Payments    | Stripe                              |
| Email       | Nodemailer (SMTP)                   |
| Security    | Helmet, CORS, Rate Limiting, bcrypt |

---

## Project Structure

```
OmanExplorer/
├── database/
│   ├── schema.sql          # Full DB schema with triggers
│   └── seed.sql            # Sample data for development
├── src/
│   ├── config/
│   │   ├── database.js     # pg Pool
│   │   └── stripe.js       # Stripe client
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── bookingController.js
│   │   ├── paymentController.js
│   │   ├── reviewController.js
│   │   ├── tourController.js
│   │   └── userController.js
│   ├── middleware/
│   │   ├── auth.js         # JWT verification
│   │   ├── errorHandler.js # Global errors + validation
│   │   └── roles.js        # Role-based access control
│   ├── routes/
│   │   ├── auth.js
│   │   ├── bookings.js
│   │   ├── payments.js
│   │   ├── reviews.js
│   │   ├── tours.js
│   │   └── users.js
│   ├── services/
│   │   └── emailService.js
│   └── app.js              # Express entry point
├── .env.example
├── .gitignore
└── package.json
```

---

## Quick Start

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Stripe account (for payments)

### 2. Clone & Install

```bash
git clone <your-repo>
cd OmanExplorer
npm install
```

### 3. Environment Variables

```bash
cp .env.example .env
# Edit .env with your values
```

### 4. Database Setup

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE oman_explorer;"

# Run schema
psql -U postgres -d oman_explorer -f database/schema.sql

# Load seed data (optional, for development)
psql -U postgres -d oman_explorer -f database/seed.sql
```

Or use the npm scripts:
```bash
npm run db:setup
npm run db:seed
```

### 5. Run the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server starts at: `http://localhost:3000`

---

## User Roles

| Role      | Capabilities                                              |
|-----------|-----------------------------------------------------------|
| `tourist` | Browse tours, make bookings, write reviews                |
| `guide`   | Assigned to tours by companies                            |
| `company` | Create/manage tours, view own bookings                    |
| `admin`   | Full access: users, tours, bookings, stats, refunds       |

---

## API Endpoints

### Auth  `/api/auth`

| Method | Endpoint       | Auth | Description              |
|--------|----------------|------|--------------------------|
| POST   | `/register`    | No   | Register new user        |
| POST   | `/login`       | No   | Login, get tokens        |
| POST   | `/refresh`     | No   | Refresh access token     |
| POST   | `/logout`      | Yes  | Invalidate refresh token |
| GET    | `/me`          | Yes  | Get current user         |

**Register body:**
```json
{
  "name": "Sara Johnson",
  "email": "sara@example.com",
  "password": "Password123!",
  "role": "tourist",
  "phone": "+1234567890"
}
```

**Login response:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "name": "Sara Johnson", "role": "tourist" },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

---

### Tours  `/api/tours`

| Method | Endpoint          | Auth           | Description              |
|--------|-------------------|----------------|--------------------------|
| GET    | `/`               | No             | List tours (with filters)|
| GET    | `/:id`            | No             | Tour detail + availability|
| POST   | `/`               | company, admin | Create tour              |
| PUT    | `/:id`            | company, admin | Update tour              |
| DELETE | `/:id`            | admin          | Delete tour              |
| POST   | `/:id/images`     | company, admin | Add tour image           |
| GET    | `/:tourId/reviews`| No             | Tour reviews + stats     |

**List filters (query params):**
```
?category=Desert&region=Al+Sharqiyah&minPrice=50&maxPrice=300
&difficulty=moderate&minRating=4&search=wadi
&sortBy=price&sortOrder=ASC&page=1&limit=12
```

**Create tour body:**
```json
{
  "title": "Wahiba Sands Desert Safari",
  "description": "Two-day desert adventure...",
  "location": "Wahiba Sands",
  "region": "Al Sharqiyah",
  "price": 150.00,
  "duration_days": 2,
  "max_participants": 12,
  "category": "Desert",
  "difficulty": "moderate",
  "includes": ["Transport", "Meals", "Accommodation"],
  "excludes": ["Travel insurance", "Tips"],
  "meeting_point": "Muscat Grand Mall",
  "availability": [
    { "date": "2025-07-01", "available_spots": 12 },
    { "date": "2025-07-15", "available_spots": 12 }
  ]
}
```

---

### Bookings  `/api/bookings`

| Method | Endpoint             | Auth           | Description            |
|--------|----------------------|----------------|------------------------|
| POST   | `/`                  | tourist        | Create booking         |
| GET    | `/`                  | Yes            | List own/all bookings  |
| GET    | `/:id`               | Yes            | Booking detail         |
| PATCH  | `/:id/cancel`        | Yes            | Cancel booking         |
| PATCH  | `/:id/status`        | admin, company | Update booking status  |

**Create booking body:**
```json
{
  "tour_id": "uuid",
  "availability_id": "uuid",
  "participants": 2,
  "special_requests": "Vegetarian meals please"
}
```

---

### Payments  `/api/payments`

| Method | Endpoint          | Auth  | Description                   |
|--------|-------------------|-------|-------------------------------|
| POST   | `/create-intent`  | Yes   | Create Stripe Payment Intent  |
| POST   | `/webhook`        | None  | Stripe webhook handler        |
| POST   | `/refund`         | admin | Issue a refund                |

**Payment flow:**
1. Tourist creates booking → gets `booking_id`
2. Frontend calls `POST /api/payments/create-intent` → gets `clientSecret`
3. Frontend uses Stripe.js to complete payment with `clientSecret`
4. Stripe sends webhook → booking status updated to `confirmed` + `paid`

---

### Reviews  `/api/reviews`

| Method | Endpoint   | Auth    | Description                        |
|--------|------------|---------|------------------------------------|
| POST   | `/`        | tourist | Submit review (completed tours only)|
| DELETE | `/:id`     | Yes     | Delete own review (admin: any)      |

**Review body:**
```json
{
  "tour_id": "uuid",
  "booking_id": "uuid",
  "rating": 5,
  "comment": "Absolutely incredible experience!"
}
```

---

### Users  `/api/users`

| Method | Endpoint              | Auth  | Description          |
|--------|-----------------------|-------|----------------------|
| GET    | `/profile`            | Yes   | Get own profile      |
| PUT    | `/profile`            | Yes   | Update profile       |
| PUT    | `/change-password`    | Yes   | Change password      |
| GET    | `/admin/users`        | admin | List all users       |
| PATCH  | `/admin/users/:id`    | admin | Update user role/status |
| GET    | `/admin/stats`        | admin | Dashboard statistics |

---

## Authentication

All protected routes require:
```
Authorization: Bearer <accessToken>
```

Access tokens expire in **7 days**. Use `POST /api/auth/refresh` with the refresh token to get a new pair.

---

## Stripe Webhook Setup

1. Install the Stripe CLI: https://stripe.com/docs/stripe-cli
2. Run: `stripe listen --forward-to localhost:3000/api/payments/webhook`
3. Copy the webhook signing secret and set `STRIPE_WEBHOOK_SECRET` in `.env`

---

## Seed Credentials (Development)

| Role    | Email                          | Password      |
|---------|--------------------------------|---------------|
| admin   | admin@omanexplorer.com         | Password123!  |
| company | company@muscatadventures.com   | Password123!  |
| guide   | guide@omanexplorer.com         | Password123!  |
| tourist | tourist@example.com            | Password123!  |

---

## Environment Variables Reference

| Variable                | Description                        |
|-------------------------|------------------------------------|
| `PORT`                  | Server port (default: 3000)        |
| `NODE_ENV`              | `development` or `production`      |
| `DB_HOST/PORT/NAME/USER/PASSWORD` | PostgreSQL connection    |
| `JWT_SECRET`            | Secret for access tokens           |
| `JWT_EXPIRES_IN`        | Access token lifetime (e.g. `7d`)  |
| `JWT_REFRESH_SECRET`    | Secret for refresh tokens          |
| `JWT_REFRESH_EXPIRES_IN`| Refresh token lifetime (e.g. `30d`)|
| `STRIPE_SECRET_KEY`     | Stripe secret key (`sk_test_...`)  |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret      |
| `EMAIL_HOST/PORT/USER/PASS` | SMTP credentials               |
| `CLIENT_URL`            | Frontend URL for CORS              |

---

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong random `JWT_SECRET` and `JWT_REFRESH_SECRET`
- [ ] Switch to Stripe live keys (`sk_live_...`)
- [ ] Set up a real SMTP provider (SendGrid, AWS SES, etc.)
- [ ] Enable PostgreSQL SSL (`ssl: { rejectUnauthorized: false }` in `database.js`)
- [ ] Set up a reverse proxy (Nginx) in front of the Node server
- [ ] Configure a process manager (PM2)
- [ ] Set `CLIENT_URL` to your actual frontend domain
- [ ] Store secrets in environment variables, not code
