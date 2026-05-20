-- GUIDEON Database Schema
-- Run: psql -U postgres -c "CREATE DATABASE oman_explorer;"
-- Then: psql -U postgres -d oman_explorer -f database/schema.sql

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
--  USERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255)        NOT NULL,
  email          VARCHAR(255) UNIQUE NOT NULL,
  password_hash  VARCHAR(255)        NOT NULL,
  role           VARCHAR(50)         NOT NULL DEFAULT 'tourist'
                   CHECK (role IN ('tourist', 'admin', 'guide', 'company')),
  phone          VARCHAR(50),
  avatar_url     TEXT,
  is_active      BOOLEAN             DEFAULT true,
  email_verified BOOLEAN             DEFAULT false,
  refresh_token  TEXT,
  fcm_token      TEXT,
  created_at     TIMESTAMPTZ         DEFAULT NOW(),
  updated_at     TIMESTAMPTZ         DEFAULT NOW()
);

-- ─────────────────────────────────────────
--  COMPANIES  (tour operators)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  company_name   VARCHAR(255) NOT NULL,
  description    TEXT,
  license_number VARCHAR(100),
  website        VARCHAR(255),
  logo_url       TEXT,
  verified       BOOLEAN      DEFAULT false,
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  DEFAULT NOW()
);

-- ─────────────────────────────────────────
--  TOURS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tours (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID REFERENCES companies(id) ON DELETE CASCADE,
  guide_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  title            VARCHAR(255)   NOT NULL,
  description      TEXT           NOT NULL,
  location         VARCHAR(255)   NOT NULL,
  region           VARCHAR(100),
  price            NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  duration_days    INTEGER        NOT NULL CHECK (duration_days >= 1),
  max_participants INTEGER        NOT NULL CHECK (max_participants >= 1),
  category         VARCHAR(100),
  difficulty       VARCHAR(50)    DEFAULT 'moderate'
                     CHECK (difficulty IN ('easy', 'moderate', 'hard')),
  includes         TEXT[],
  excludes         TEXT[],
  meeting_point    TEXT,
  status           VARCHAR(50)    DEFAULT 'active'
                     CHECK (status IN ('active', 'inactive', 'draft')),
  avg_rating       NUMERIC(3, 2)  DEFAULT 0,
  total_reviews    INTEGER        DEFAULT 0,
  created_at       TIMESTAMPTZ    DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    DEFAULT NOW()
);

-- ─────────────────────────────────────────
--  TOUR IMAGES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tour_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id    UUID REFERENCES tours(id) ON DELETE CASCADE,
  url        TEXT    NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
--  TOUR AVAILABILITY  (specific dates)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tour_availability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id         UUID REFERENCES tours(id) ON DELETE CASCADE,
  date            DATE    NOT NULL,
  available_spots INTEGER NOT NULL CHECK (available_spots >= 0),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tour_id, date)
);

-- ─────────────────────────────────────────
--  BOOKINGS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id                 UUID REFERENCES tours(id) ON DELETE RESTRICT,
  user_id                 UUID REFERENCES users(id) ON DELETE RESTRICT,
  availability_id         UUID REFERENCES tour_availability(id) ON DELETE RESTRICT,
  participants            INTEGER        NOT NULL DEFAULT 1 CHECK (participants >= 1),
  total_price             NUMERIC(10, 2) NOT NULL,
  status                  VARCHAR(50)    DEFAULT 'pending'
                            CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  payment_status          VARCHAR(50)    DEFAULT 'unpaid'
                            CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  stripe_payment_intent_id VARCHAR(255),
  special_requests        TEXT,
  cancelled_at            TIMESTAMPTZ,
  cancellation_reason     TEXT,
  created_at              TIMESTAMPTZ    DEFAULT NOW(),
  updated_at              TIMESTAMPTZ    DEFAULT NOW()
);

-- ─────────────────────────────────────────
--  REVIEWS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id    UUID REFERENCES tours(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  rating     INTEGER     NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (booking_id)
);

-- ─────────────────────────────────────────
--  INDEXES
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tours_company        ON tours(company_id);
CREATE INDEX IF NOT EXISTS idx_tours_status         ON tours(status);
CREATE INDEX IF NOT EXISTS idx_tours_location       ON tours(location);
CREATE INDEX IF NOT EXISTS idx_tours_category       ON tours(category);
CREATE INDEX IF NOT EXISTS idx_tour_availability    ON tour_availability(tour_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_user        ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tour        ON bookings(tour_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status      ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_reviews_tour         ON reviews(tour_id);

-- ─────────────────────────────────────────
--  TRIGGER: keep updated_at current
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tours_updated_at
  BEFORE UPDATE ON tours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────
--  TRIGGER: recalculate tour avg_rating
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION refresh_tour_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tours
  SET
    avg_rating    = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE tour_id = COALESCE(NEW.tour_id, OLD.tour_id)),
    total_reviews = (SELECT COUNT(*)                 FROM reviews WHERE tour_id = COALESCE(NEW.tour_id, OLD.tour_id))
  WHERE id = COALESCE(NEW.tour_id, OLD.tour_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reviews_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION refresh_tour_rating();
