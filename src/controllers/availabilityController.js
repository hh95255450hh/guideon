const { query, getClient } = require('../config/database');

// POST /api/tours/:id/availability  — add one or many dates
const addAvailability = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { id: tourId } = req.params;

    // Verify ownership
    const tour = await client.query(
      `SELECT t.id FROM tours t
       LEFT JOIN companies c ON c.id = t.company_id
       WHERE t.id = $1 AND (c.user_id = $2 OR $3 = 'admin')`,
      [tourId, req.user.id, req.user.role]
    );
    if (!tour.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Tour not found or access denied' });
    }

    const slots = Array.isArray(req.body) ? req.body : [req.body];
    const inserted = [];

    for (const { date, available_spots } of slots) {
      if (!date || !available_spots) continue;
      const r = await client.query(
        `INSERT INTO tour_availability (tour_id, date, available_spots)
         VALUES ($1, $2, $3)
         ON CONFLICT (tour_id, date) DO UPDATE SET available_spots = $3
         RETURNING *`,
        [tourId, date, parseInt(available_spots)]
      );
      inserted.push(r.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { availability: inserted } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// GET /api/tours/:id/availability  — list future slots
const getAvailability = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, date, available_spots
       FROM tour_availability
       WHERE tour_id = $1 AND date >= CURRENT_DATE
       ORDER BY date`,
      [req.params.id]
    );
    res.json({ success: true, data: { availability: result.rows } });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/tours/:id/availability/:availId  — remove a slot
const deleteAvailability = async (req, res, next) => {
  try {
    const { id: tourId, availId } = req.params;

    // Check no confirmed bookings exist for this slot
    const booked = await query(
      `SELECT id FROM bookings
       WHERE availability_id = $1 AND status IN ('pending','confirmed')`,
      [availId]
    );
    if (booked.rows.length) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete a slot that has active bookings',
      });
    }

    const result = await query(
      'DELETE FROM tour_availability WHERE id = $1 AND tour_id = $2 RETURNING id',
      [availId, tourId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Availability slot not found' });
    }

    res.json({ success: true, message: 'Slot deleted' });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/tours/:id/availability/:availId  — update spots
const updateAvailability = async (req, res, next) => {
  try {
    const { id: tourId, availId } = req.params;
    const { available_spots } = req.body;

    if (available_spots === undefined) {
      return res.status(400).json({ success: false, message: 'available_spots is required' });
    }

    const result = await query(
      'UPDATE tour_availability SET available_spots = $1 WHERE id = $2 AND tour_id = $3 RETURNING *',
      [parseInt(available_spots), availId, tourId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }

    res.json({ success: true, data: { slot: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

module.exports = { addAvailability, getAvailability, deleteAvailability, updateAvailability };
