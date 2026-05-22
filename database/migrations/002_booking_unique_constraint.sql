-- Prevent two active bookings on the same date for the same guide.
-- Cancelled bookings are excluded so the date can be re-booked after cancellation.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_booking_per_guide_date
ON bookings ("guideId", "tourDate")
WHERE status IN ('pending', 'confirmed', 'completed');
