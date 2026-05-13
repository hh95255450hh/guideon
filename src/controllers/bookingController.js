const { query, getClient } = require('../config/database');
const notify = require('../services/notificationService');

// POST /api/bookings
const createBooking = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { tour_id, availability_id, participants = 1, special_requests } = req.body;

    // Lock the availability row to prevent overbooking
    const avail = await client.query(
      'SELECT * FROM tour_availability WHERE id = $1 AND tour_id = $2 FOR UPDATE',
      [availability_id, tour_id]
    );

    if (!avail.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Availability slot not found' });
    }

    if (avail.rows[0].available_spots < participants) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Only ${avail.rows[0].available_spots} spots available`,
      });
    }

    const tourResult = await client.query('SELECT price FROM tours WHERE id = $1', [tour_id]);
    if (!tourResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Tour not found' });
    }

    const total_price = parseFloat(tourResult.rows[0].price) * parseInt(participants);

    const booking = await client.query(
      `INSERT INTO bookings
         (tour_id, user_id, availability_id, participants, total_price, special_requests)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tour_id, req.user.id, availability_id, participants, total_price, special_requests || null]
    );

    // Decrement available spots
    await client.query(
      'UPDATE tour_availability SET available_spots = available_spots - $1 WHERE id = $2',
      [participants, availability_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Booking created. Complete payment to confirm.',
      data: { booking: booking.rows[0] },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// GET /api/bookings  (tourist sees own; admin sees all)
const listBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    if (req.user.role === 'tourist') {
      params.push(req.user.id);
      conditions.push(`b.user_id = $${params.length}`);
    } else if (req.user.role === 'company') {
      const comp = await query('SELECT id FROM companies WHERE user_id = $1', [req.user.id]);
      if (comp.rows.length) {
        params.push(comp.rows[0].id);
        conditions.push(`t.company_id = $${params.length}`);
      }
    }

    if (status) {
      params.push(status);
      conditions.push(`b.status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [bookingsResult, countResult] = await Promise.all([
      query(
        `SELECT
           b.id, b.participants, b.total_price, b.status, b.payment_status,
           b.special_requests, b.created_at,
           t.title AS tour_title, t.location AS tour_location,
           ta.date AS tour_date,
           u.name AS tourist_name, u.email AS tourist_email
         FROM bookings b
         LEFT JOIN tours t ON t.id = b.tour_id
         LEFT JOIN tour_availability ta ON ta.id = b.availability_id
         LEFT JOIN users u ON u.id = b.user_id
         ${where}
         ORDER BY b.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, parseInt(limit), offset]
      ),
      query(`SELECT COUNT(*) FROM bookings b LEFT JOIN tours t ON t.id = b.tour_id ${where}`, params),
    ]);

    res.json({
      success: true,
      data: {
        bookings: bookingsResult.rows,
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

// GET /api/bookings/:id
const getBooking = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         b.*, t.title AS tour_title, t.location AS tour_location, t.price AS tour_price,
         ta.date AS tour_date,
         u.name AS tourist_name, u.email AS tourist_email, u.phone AS tourist_phone
       FROM bookings b
       LEFT JOIN tours t ON t.id = b.tour_id
       LEFT JOIN tour_availability ta ON ta.id = b.availability_id
       LEFT JOIN users u ON u.id = b.user_id
       WHERE b.id = $1`,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = result.rows[0];

    // Tourists can only view their own bookings
    if (req.user.role === 'tourist' && booking.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: { booking } });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/bookings/:id/cancel
const cancelBooking = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = result.rows[0];

    if (req.user.role === 'tourist' && booking.user_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (['cancelled', 'completed'].includes(booking.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Booking is already ${booking.status}` });
    }

    await client.query(
      `UPDATE bookings
       SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $1
       WHERE id = $2`,
      [req.body.reason || null, booking.id]
    );

    // Restore available spots
    await client.query(
      'UPDATE tour_availability SET available_spots = available_spots + $1 WHERE id = $2',
      [booking.participants, booking.availability_id]
    );

    await client.query('COMMIT');

    // Push notification (fire-and-forget — don't await)
    const tourResult = await query(
      'SELECT t.title FROM tours t JOIN bookings b ON b.tour_id = t.id WHERE b.id = $1',
      [booking.id]
    ).catch(() => ({ rows: [] }));
    if (tourResult.rows.length) {
      notify.sendBookingCancellation({
        userId:    booking.user_id,
        tourTitle: tourResult.rows[0].title,
        bookingId: booking.id,
      });
    }

    res.json({ success: true, message: 'Booking cancelled' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// PATCH /api/bookings/:id/status  (admin/company)
const updateBookingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['confirmed', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const result = await query(
      'UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.json({ success: true, data: { booking: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

module.exports = { createBooking, listBookings, getBooking, cancelBooking, updateBookingStatus };
