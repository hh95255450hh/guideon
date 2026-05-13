const { query, getClient } = require('../config/database');

// GET /api/tours
const listTours = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      region,
      location,
      difficulty,
      minPrice,
      maxPrice,
      minRating,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = ["t.status = 'active'"];
    const params = [];

    if (category) {
      params.push(category);
      conditions.push(`t.category = $${params.length}`);
    }
    if (region) {
      params.push(region);
      conditions.push(`t.region = $${params.length}`);
    }
    if (location) {
      params.push(`%${location}%`);
      conditions.push(`t.location ILIKE $${params.length}`);
    }
    if (difficulty) {
      params.push(difficulty);
      conditions.push(`t.difficulty = $${params.length}`);
    }
    if (minPrice) {
      params.push(parseFloat(minPrice));
      conditions.push(`t.price >= $${params.length}`);
    }
    if (maxPrice) {
      params.push(parseFloat(maxPrice));
      conditions.push(`t.price <= $${params.length}`);
    }
    if (minRating) {
      params.push(parseFloat(minRating));
      conditions.push(`t.avg_rating >= $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const allowedSorts = ['price', 'avg_rating', 'created_at', 'duration_days'];
    const col = allowedSorts.includes(sortBy) ? `t.${sortBy}` : 't.created_at';
    const dir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const [toursResult, countResult] = await Promise.all([
      query(
        `SELECT
           t.id, t.title, t.location, t.region, t.price, t.duration_days,
           t.max_participants, t.category, t.difficulty, t.avg_rating,
           t.total_reviews, t.status, t.created_at,
           c.company_name,
           (SELECT url FROM tour_images WHERE tour_id = t.id AND is_primary = true LIMIT 1) AS primary_image
         FROM tours t
         LEFT JOIN companies c ON c.id = t.company_id
         ${where}
         ORDER BY ${col} ${dir}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, parseInt(limit), offset]
      ),
      query(
        `SELECT COUNT(*) FROM tours t ${where}`,
        params
      ),
    ]);

    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        tours: toursResult.rows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/tours/:id
const getTour = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [tourResult, imagesResult, availabilityResult] = await Promise.all([
      query(
        `SELECT
           t.*, c.company_name, c.description AS company_description, c.website,
           u.name AS guide_name, u.phone AS guide_phone
         FROM tours t
         LEFT JOIN companies c ON c.id = t.company_id
         LEFT JOIN users u ON u.id = t.guide_id
         WHERE t.id = $1`,
        [id]
      ),
      query('SELECT id, url, is_primary FROM tour_images WHERE tour_id = $1', [id]),
      query(
        `SELECT id, date, available_spots
         FROM tour_availability
         WHERE tour_id = $1 AND date >= CURRENT_DATE AND available_spots > 0
         ORDER BY date`,
        [id]
      ),
    ]);

    if (!tourResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Tour not found' });
    }

    const tour = tourResult.rows[0];
    tour.images = imagesResult.rows;
    tour.availability = availabilityResult.rows;

    res.json({ success: true, data: { tour } });
  } catch (err) {
    next(err);
  }
};

// POST /api/tours  (company or admin)
const createTour = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const {
      title, description, location, region, price, duration_days,
      max_participants, category, difficulty, includes, excludes,
      meeting_point, guide_id, availability = [],
    } = req.body;

    // Resolve company_id from logged-in user
    let company_id = null;
    if (req.user.role === 'company') {
      const comp = await client.query('SELECT id FROM companies WHERE user_id = $1', [req.user.id]);
      if (!comp.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Company profile not found' });
      }
      company_id = comp.rows[0].id;
    } else if (req.user.role === 'admin' && req.body.company_id) {
      company_id = req.body.company_id;
    }

    const tourResult = await client.query(
      `INSERT INTO tours
         (company_id, guide_id, title, description, location, region, price,
          duration_days, max_participants, category, difficulty, includes, excludes, meeting_point)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        company_id, guide_id || null, title, description, location, region || null,
        price, duration_days, max_participants, category || null,
        difficulty || 'moderate', includes || [], excludes || [], meeting_point || null,
      ]
    );

    const tour = tourResult.rows[0];

    if (availability.length) {
      const availValues = availability
        .map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`)
        .join(', ');
      const availParams = [tour.id];
      availability.forEach(({ date, available_spots }) => {
        availParams.push(date, available_spots);
      });
      await client.query(
        `INSERT INTO tour_availability (tour_id, date, available_spots) VALUES ${availValues}`,
        availParams
      );
    }

    await client.query('COMMIT');

    res.status(201).json({ success: true, message: 'Tour created', data: { tour } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// PUT /api/tours/:id  (company owner or admin)
const updateTour = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT * FROM tours t LEFT JOIN companies c ON c.id = t.company_id WHERE t.id = $1', [id]);
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, message: 'Tour not found' });
    }

    if (req.user.role === 'company' && existing.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this tour' });
    }

    const fields = ['title','description','location','region','price','duration_days',
      'max_participants','category','difficulty','includes','excludes','meeting_point','guide_id','status'];
    const updates = [];
    const params = [];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        params.push(req.body[field]);
        updates.push(`${field} = $${params.length}`);
      }
    });

    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(id);
    const result = await query(
      `UPDATE tours SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    res.json({ success: true, message: 'Tour updated', data: { tour: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/tours/:id  (admin only)
const deleteTour = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM tours WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Tour not found' });
    }
    res.json({ success: true, message: 'Tour deleted' });
  } catch (err) {
    next(err);
  }
};

// POST /api/tours/:id/images
const addTourImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { url, is_primary = false } = req.body;

    if (is_primary) {
      await query('UPDATE tour_images SET is_primary = false WHERE tour_id = $1', [id]);
    }

    const result = await query(
      'INSERT INTO tour_images (tour_id, url, is_primary) VALUES ($1, $2, $3) RETURNING *',
      [id, url, is_primary]
    );

    res.status(201).json({ success: true, data: { image: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

module.exports = { listTours, getTour, createTour, updateTour, deleteTour, addTourImage };
