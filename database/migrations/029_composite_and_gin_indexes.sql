-- ============================================================================
-- 029_composite_and_gin_indexes.sql
-- ----------------------------------------------------------------------------
-- High-value indexes that match the app's ACTUAL query patterns.
-- Migration 003 added single-column indexes; these composite + GIN indexes
-- target the exact "filter then sort" and "array contains" queries used in
-- the booking dashboards and guide search.
--
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================================

-- ── BOOKINGS: filter by user + sort by date (myBookings / guideBookings) ──
-- Query: WHERE touristId = ? ORDER BY createdAt DESC
-- A composite index serves both the filter and the sort in one scan.
CREATE INDEX IF NOT EXISTS idx_bookings_tourist_created
  ON bookings ("touristId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_guide_created
  ON bookings ("guideId", "createdAt" DESC);

-- ── GUIDE SEARCH: array-contains filters (destinations / languages / specs) ──
-- Query: WHERE destinations @> ARRAY[?]  (governorate / destination filter)
-- GIN indexes make array membership checks fast instead of full-table scans.
CREATE INDEX IF NOT EXISTS idx_users_destinations_gin
  ON users USING GIN ("destinations")
  WHERE "userType" = 'guide';

CREATE INDEX IF NOT EXISTS idx_users_languages_gin
  ON users USING GIN ("languages")
  WHERE "userType" = 'guide';

CREATE INDEX IF NOT EXISTS idx_users_specialisations_gin
  ON users USING GIN ("specialisations")
  WHERE "userType" = 'guide';

-- ── REVIEWS: fetch all reviews for a set of bookings (myBookings join) ──
-- Already have idx_reviews_bookingId; this covers the guide-rating sort.
CREATE INDEX IF NOT EXISTS idx_reviews_guide_created
  ON reviews ("guideId", "createdAt" DESC);

-- ── TOUR PACKAGES: published-tours lookup in guide search ──
CREATE INDEX IF NOT EXISTS idx_packages_published
  ON tour_packages ("isPublished")
  WHERE "isPublished" = true;
