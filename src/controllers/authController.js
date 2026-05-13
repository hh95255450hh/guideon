const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, getClient } = require('../config/database');

const signAccessToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const signRefreshToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });

// POST /api/auth/register
const register = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { name, email, password, role = 'tourist', phone, company_name } = req.body;

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const allowedSelfRoles = ['tourist', 'guide', 'company'];
    const assignedRole = allowedSelfRoles.includes(role) ? role : 'tourist';

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await client.query(
      `INSERT INTO users (name, email, password_hash, role, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, created_at`,
      [name, email, passwordHash, assignedRole, phone || null]
    );

    const user = result.rows[0];

    // Auto-create company profile when registering as 'company'
    let company = null;
    if (assignedRole === 'company') {
      const compResult = await client.query(
        `INSERT INTO companies (user_id, company_name)
         VALUES ($1, $2) RETURNING id, company_name, verified`,
        [user.id, company_name || name]
      );
      company = compResult.rows[0];
    }

    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id);

    await client.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { user, company, accessToken, refreshToken },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await query(
      'SELECT id, name, email, role, password_hash, is_active FROM users WHERE email = $1',
      [email]
    );

    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id);

    await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

    const { password_hash, ...safeUser } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: { user: safeUser, accessToken, refreshToken },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/refresh
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const result = await query(
      'SELECT id, name, email, role, refresh_token, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows.length || result.rows[0].refresh_token !== refreshToken) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const user = result.rows[0];
    const newAccessToken = signAccessToken(user.id);
    const newRefreshToken = signRefreshToken(user.id);

    await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [newRefreshToken, user.id]);

    res.json({
      success: true,
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }
    next(err);
  }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    await query('UPDATE users SET refresh_token = NULL WHERE id = $1', [req.user.id]);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, name, email, role, phone, avatar_url, email_verified, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({ success: true, data: { user: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout, getMe };
