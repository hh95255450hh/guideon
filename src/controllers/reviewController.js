const { query } = require('../config/database');

// POST /api/reviews
const createReview = async (req, res, next) => {
  try {
    const { tour_id, booking_id, rating, comment } = req.body;

    // Verify booking belongs to user and is completed
    const bookingResult = await query(
      `SELECT * FROM bookings
       WHERE id = $1 AND user_id = $2 AND tour_id = $3 AND status = 'completed'`,
      [booking_id, req.user.id, tour_id]
    );

    if (!bookingResult.rows.length) {
      return res.status(400).json({
        success: false,
        message: 'You can only review completed tours that you booked',
      });
    }

    const result = await query(
      `INSERT INTO reviews (tour_id, user_id, booking_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tour_id, req.user.id, booking_id, rating, comment || null]
    );

    res.status(201).json({ success: true, message: 'Review submitted', data: { review: result.rows[0] } });
  } catch (err) {
    // Unique violation means user already reviewed this booking
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'You have already reviewed this booking' });
    }
    next(err);
  }
};

// GET /api/tours/:tourId/reviews
const getTourReviews = async (req, res, next) => {
  try {
    const { tourId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [reviewsResult, countResult, statsResult] = await Promise.all([
      query(
        `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS reviewer_name, u.avatar_url
         FROM reviews r
         JOIN users u ON u.id = r.user_id
         WHERE r.tour_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [tourId, parseInt(limit), offset]
      ),
      query('SELECT COUNT(*) FROM reviews WHERE tour_id = $1', [tourId]),
      query(
        `SELECT
           ROUND(AVG(rating), 2) AS avg_rating,
           COUNT(*) AS total,
           SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS five_star,
           SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS four_star,
           SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS three_star,
           SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS two_star,
           SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS one_star
         FROM reviews WHERE tour_id = $1`,
        [tourId]
      ),
    ]);

    res.json({
      success: true,
      data: {
        reviews: reviewsResult.rows,
        stats: statsResult.rows[0],
        pagination: {
          total: parseInt(countResult.rows[0].count),
          page: parseInt(page),
          limit: parseInt(limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/reviews/:id  (owner or admin)
const deleteReview = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM reviews WHERE id = $1', [req.params.id]);
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (req.user.role !== 'admin' && result.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await query('DELETE FROM reviews WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createReview, getTourReviews, deleteReview };
