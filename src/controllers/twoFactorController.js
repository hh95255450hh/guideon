/**
 * Two-Factor Authentication (TOTP)
 * Compatible with Google Authenticator, Authy, 1Password, etc.
 */
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const SupabaseDB = require('../models/SupabaseDB');

const users = new SupabaseDB('users');

function genBackupCodes(n = 10) {
  return Array.from({ length: n }, () =>
    crypto.randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g).join('-')
  );
}

// POST /api/2fa/setup — generate a new secret + QR (pending verification)
exports.setup = async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ success: false, message: 'Not authenticated.' });

    const user = await users.findById(req.session.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.twoFactorEnabled) {
      return res.status(400).json({ success: false, message: 'Two-factor is already enabled. Disable it first.' });
    }

    const secret = speakeasy.generateSecret({
      name: `Guideon (${user.email})`,
      issuer: 'Guideon',
      length: 20,
    });

    // Store the secret temporarily in the session — only persisted to DB after verification
    req.session.pending2faSecret = secret.base32;

    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      success: true,
      secret: secret.base32,
      qrCode: qrDataUrl,
      otpauth: secret.otpauth_url,
    });
  } catch (err) {
    console.error('[2FA setup]', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/2fa/enable — verify a TOTP code and persist the secret
exports.enable = async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ success: false, message: 'Not authenticated.' });
    const { code } = req.body;
    const secret = req.session.pending2faSecret;
    if (!secret) return res.status(400).json({ success: false, message: 'Run setup first.' });
    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, message: 'Invalid code format.' });
    }

    const ok = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 });
    if (!ok) return res.status(401).json({ success: false, message: 'Wrong code. Try again.' });

    const backupCodes = genBackupCodes();
    await users.update(req.session.userId, {
      twoFactorSecret: secret,
      twoFactorEnabled: true,
      twoFactorBackupCodes: backupCodes,
    });

    delete req.session.pending2faSecret;
    res.json({ success: true, message: 'Two-factor enabled.', backupCodes });
  } catch (err) {
    console.error('[2FA enable]', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/2fa/verify — used during login (with tempToken in session)
exports.verifyLogin = async (req, res) => {
  try {
    const { code } = req.body;
    const pendingId = req.session.pending2faUserId;
    if (!pendingId) return res.status(401).json({ success: false, message: 'No pending login.' });
    if (!code) return res.status(400).json({ success: false, message: 'Code required.' });

    const user = await users.findById(pendingId);
    if (!user || !user.twoFactorEnabled) return res.status(401).json({ success: false, message: 'Invalid state.' });

    let valid = false;
    if (/^\d{6}$/.test(code)) {
      valid = speakeasy.totp.verify({
        secret: user.twoFactorSecret, encoding: 'base32', token: code, window: 1,
      });
    } else {
      // Try as a backup code
      const normalized = code.toUpperCase().replace(/\s/g, '');
      const remaining = (user.twoFactorBackupCodes || []).filter(c => c !== normalized);
      if (remaining.length < (user.twoFactorBackupCodes || []).length) {
        valid = true;
        await users.update(user.id, { twoFactorBackupCodes: remaining });
      }
    }

    if (!valid) return res.status(401).json({ success: false, message: 'Wrong code.' });

    // Promote the pending login into a real session
    await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    req.session.userId = user.id;
    req.session.userType = user.userType;

    const safe = { ...user };
    delete safe.password;
    delete safe.twoFactorSecret;
    delete safe.twoFactorBackupCodes;
    res.json({ success: true, message: 'Login successful.', user: safe });
  } catch (err) {
    console.error('[2FA verifyLogin]', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/2fa/disable — requires current password and TOTP code
exports.disable = async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ success: false, message: 'Not authenticated.' });
    const { password, code } = req.body;
    const bcrypt = require('bcryptjs');
    const user = await users.findById(req.session.userId);
    if (!user || !user.twoFactorEnabled) {
      return res.status(400).json({ success: false, message: '2FA not enabled.' });
    }

    if (!password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Wrong password.' });
    }

    if (!code || !speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: code, window: 1 })) {
      return res.status(401).json({ success: false, message: 'Wrong code.' });
    }

    await users.update(user.id, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
    });
    res.json({ success: true, message: 'Two-factor disabled.' });
  } catch (err) {
    console.error('[2FA disable]', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/2fa/status
exports.status = async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ success: false });
  const user = await users.findById(req.session.userId);
  res.json({ success: true, enabled: !!user?.twoFactorEnabled });
};
