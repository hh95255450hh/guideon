const { query } = require('../config/database');
const { getFileUrl } = require('../services/uploadService');

// GET /api/companies
const listCompanies = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, verified, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    if (verified !== undefined) {
      params.push(verified === 'true');
      conditions.push(`c.verified = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`c.company_name ILIKE $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [companies, count] = await Promise.all([
      query(
        `SELECT c.id, c.company_name, c.description, c.website, c.logo_url,
                c.verified, c.created_at,
                COUNT(DISTINCT t.id) AS total_tours,
                ROUND(AVG(t.avg_rating), 2) AS avg_rating
         FROM companies c
         LEFT JOIN tours t ON t.company_id = c.id AND t.status = 'active'
         ${where}
         GROUP BY c.id
         ORDER BY c.verified DESC, c.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, parseInt(limit), offset]
      ),
      query(`SELECT COUNT(*) FROM companies c ${where}`, params),
    ]);

    res.json({
      success: true,
      data: {
        companies: companies.rows,
        pagination: {
          total: parseInt(count.rows[0].count),
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(parseInt(count.rows[0].count) / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/companies/:id
const getCompany = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [companyResult, toursResult] = await Promise.all([
      query(
        `SELECT c.*, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone,
                COUNT(DISTINCT t.id) AS total_tours,
                ROUND(AVG(t.avg_rating), 2) AS avg_rating,
                SUM(t.total_reviews) AS total_reviews
         FROM companies c
         JOIN users u ON u.id = c.user_id
         LEFT JOIN tours t ON t.company_id = c.id AND t.status = 'active'
         WHERE c.id = $1
         GROUP BY c.id, u.name, u.email, u.phone`,
        [id]
      ),
      query(
        `SELECT t.id, t.title, t.location, t.region, t.price, t.duration_days,
                t.max_participants, t.category, t.difficulty, t.avg_rating,
                t.total_reviews, t.status,
                (SELECT url FROM tour_images WHERE tour_id = t.id AND is_primary = true LIMIT 1) AS primary_image
         FROM tours t
         WHERE t.company_id = $1 AND t.status = 'active'
         ORDER BY t.created_at DESC`,
        [id]
      ),
    ]);

    if (!companyResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const company = companyResult.rows[0];
    company.tours = toursResult.rows;

    res.json({ success: true, data: { company } });
  } catch (err) {
    next(err);
  }
};

// POST /api/companies/profile  — company user creates or updates own profile
const upsertProfile = async (req, res, next) => {
  try {
    const { company_name, description, license_number, website } = req.body;

    const existing = await query('SELECT id FROM companies WHERE user_id = $1', [req.user.id]);

    let result;
    if (existing.rows.length) {
      result = await query(
        `UPDATE companies
         SET company_name = COALESCE($1, company_name),
             description   = COALESCE($2, description),
             license_number = COALESCE($3, license_number),
             website       = COALESCE($4, website),
             updated_at    = NOW()
         WHERE user_id = $5
         RETURNING *`,
        [company_name || null, description || null, license_number || null, website || null, req.user.id]
      );
    } else {
      if (!company_name) {
        return res.status(400).json({ success: false, message: 'company_name is required' });
      }
      result = await query(
        `INSERT INTO companies (user_id, company_name, description, license_number, website)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.user.id, company_name, description || null, license_number || null, website || null]
      );
    }

    res.json({ success: true, data: { company: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

// POST /api/companies/logo  — upload company logo
const uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Logo image is required' });
    }

    const logoUrl = getFileUrl(req, req.file);

    const result = await query(
      'UPDATE companies SET logo_url = $1 WHERE user_id = $2 RETURNING id, logo_url',
      [logoUrl, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Company profile not found — create it first' });
    }

    res.json({ success: true, data: { logo_url: logoUrl } });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/companies/:id/verify  — admin only
const verifyCompany = async (req, res, next) => {
  try {
    const { verified } = req.body;

    const result = await query(
      'UPDATE companies SET verified = $1 WHERE id = $2 RETURNING id, company_name, verified',
      [verified === true || verified === 'true', req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    res.json({ success: true, data: { company: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

// GET /api/companies/me  — company user sees own profile
const getMyCompany = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.*, u.name AS owner_name, u.email AS owner_email
       FROM companies c
       JOIN users u ON u.id = c.user_id
       WHERE c.user_id = $1`,
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'No company profile found — create one first' });
    }

    res.json({ success: true, data: { company: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

module.exports = { listCompanies, getCompany, upsertProfile, uploadLogo, verifyCompany, getMyCompany };
