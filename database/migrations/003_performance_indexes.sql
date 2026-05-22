-- Indexes for production-grade query performance.
-- Run after baseline schema is in place.

-- USERS
CREATE INDEX IF NOT EXISTS idx_users_email           ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_userType        ON users ("userType");
CREATE INDEX IF NOT EXISTS idx_users_isVerified      ON users ("isVerified") WHERE "isVerified" = true;
CREATE INDEX IF NOT EXISTS idx_users_isSuspended     ON users ("isSuspended") WHERE "isSuspended" = false;
CREATE INDEX IF NOT EXISTS idx_users_verifyToken     ON users ("emailVerifyToken") WHERE "emailVerifyToken" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_resetToken      ON users ("resetPasswordToken") WHERE "resetPasswordToken" IS NOT NULL;

-- BOOKINGS
CREATE INDEX IF NOT EXISTS idx_bookings_touristId    ON bookings ("touristId");
CREATE INDEX IF NOT EXISTS idx_bookings_guideId      ON bookings ("guideId");
CREATE INDEX IF NOT EXISTS idx_bookings_status       ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_createdAt    ON bookings ("createdAt" DESC);

-- REVIEWS
CREATE INDEX IF NOT EXISTS idx_reviews_guideId       ON reviews ("guideId");
CREATE INDEX IF NOT EXISTS idx_reviews_bookingId     ON reviews ("bookingId");
CREATE INDEX IF NOT EXISTS idx_reviews_createdAt     ON reviews ("createdAt" DESC);

-- MESSAGES
CREATE INDEX IF NOT EXISTS idx_messages_fromId       ON messages ("fromId");
CREATE INDEX IF NOT EXISTS idx_messages_toId         ON messages ("toId");
CREATE INDEX IF NOT EXISTS idx_messages_unread       ON messages ("toId", "isRead") WHERE "isRead" = false;
CREATE INDEX IF NOT EXISTS idx_messages_createdAt    ON messages ("createdAt" DESC);

-- TRIP_REQUESTS
CREATE INDEX IF NOT EXISTS idx_trip_requests_touristId ON trip_requests ("touristId");
CREATE INDEX IF NOT EXISTS idx_trip_requests_status    ON trip_requests (status);
