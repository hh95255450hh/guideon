const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

// GET /api/users/profile
const getProfile = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.phone, u.avatar_url,
              u.email_verified, u.created_at,
              c.id AS company_id, c.company_name, c.verified AS company_verified
       FROM users u
       LEFT JOIN companies c ON c.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    res.json({ success: true, data: { user: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, avatar_url } = req.body;
    const result = await query(
      `UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone),
              avatar_url = COALESCE($3, avatar_url)
       WHERE id = $4
       RETURNING id, name, email, role, phone, avatar_url`,
      [name || null, phone || null, avatar_url || null, req.user.id]
    );
    res.json({ success: true, data: { user: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const match = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1, refresh_token = NULL WHERE id = $2', [hash, req.user.id]);

    res.json({ success: true, message: 'Password updated. Please log in again.' });
  } catch (err) {
    next(err);
  }
};

// ─── Admin endpoints ─────────────────────────────────────────────────────────

// GET /api/admin/users
const listUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    if (role) {
      params.push(role);
      conditions.push(`role = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [users, count] = await Promise.all([
      query(
        `SELECT id, name, email, role, phone, is_active, email_verified, created_at
         FROM users ${where} ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, parseInt(limit), offset]
      ),
      query(`SELECT COUNT(*) FROM users ${where}`, params),
    ]);

    res.json({
      success: true,
      data: {
        users: users.rows,
        pagination: { total: parseInt(count.rows[0].count), page: parseInt(page), limit: parseInt(limit) },
      },
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/users/:id
const updateUser = async (req, res, next) => {
  try {
    const { role, is_active } = req.body;
    const updates = [];
    const params = [];

    if (role !== undefined) {
      params.push(role);
      updates.push(`role = $${params.length}`);
    }
    if (is_active !== undefined) {
      params.push(is_active);
      updates.push(`is_active = $${params.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    params.push(req.params.id);
    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length}
       RETURNING id, name, email, role, is_active`,
      params
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: { user: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/stats
const getDashboardStats = async (req, res, next) => {
  try {
    const [users, tours, bookings, revenue] = await Promise.all([
      query('SELECT role, COUNT(*) AS count FROM users GROUP BY role'),
      query("SELECT status, COUNT(*) AS count FROM tours GROUP BY status"),
      query("SELECT status, COUNT(*) AS count FROM bookings GROUP BY status"),
      query("SELECT COALESCE(SUM(total_price), 0) AS total FROM bookings WHERE payment_status = 'paid'"),
    ]);

    res.json({
      success: true,
      data: {
        users: users.rows,
        tours: tours.rows,
        bookings: bookings.rows,
        totalRevenue: revenue.rows[0].total,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile, changePassword, listUsers, updateUser, getDashboardStats };
