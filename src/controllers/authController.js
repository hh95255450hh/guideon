const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const emailService = require('../services/emailService');

const users = new SupabaseDB('users');

// How many password-only logins are allowed between TOTP prompts.
// The admin asked to be prompted every 10th login rather than every time.
// Override with env LOGINS_BEFORE_2FA if you want it stricter/looser.
const LOGINS_BEFORE_2FA = parseInt(process.env.LOGINS_BEFORE_2FA, 10) || 10;

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validates password strength.
 * Returns null if valid, or error message string if invalid.
 */
function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password is too long (max 128 chars).';
  // Require any TWO of: lowercase, uppercase, digit, symbol.
  // Less frustrating than mandating all four, but still rules out trivially weak passwords.
  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  if (classes < 2) {
    return 'Password must include at least two of: lowercase, uppercase, number, symbol.';
  }
  // Reject common weak passwords
  const weak = ['password', '12345678', 'qwerty', 'admin123', 'password1', 'guideon', '11111111', '00000000', 'abcdefgh'];
  if (weak.includes(password.toLowerCase())) return 'Password is too common. Choose a stronger one.';
  return null;
}

exports.register = async (req, res) => {
  try {
    const { fullName, email, password, userType, phone, nationality, preferredLanguage,
            hasMinistryLicence, licenceNumber, languages, specialisations, destinations, pricePerDay, bio,
            companyName, companyRegNo, companyServices, companyDestinations, companyDescription } = req.body;

    if (!fullName || !email || !password || !userType) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }
    const pwdError = validatePasswordStrength(password);
    if (pwdError) {
      return res.status(400).json({ success: false, message: pwdError });
    }
    if (userType === 'company' && !companyName) {
      return res.status(400).json({ success: false, message: 'Company name is required.' });
    }

    const existing = await users.findByField('email', email.toLowerCase());
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered. Please log in.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const prefix = userType === 'guide' ? 'guide' : userType === 'company' ? 'company' : userType === 'admin' ? 'admin' : 'tourist';
    const id = prefix + '-' + uuidv4().slice(0, 8);

    const verifyToken = randomToken();
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const base = {
      id, fullName, email: email.toLowerCase(), password: hashed,
      phone: phone || '', userType,
      createdAt: new Date().toISOString(), isSuspended: false,
      emailVerified: false,
      emailVerifyToken: verifyToken,
      emailVerifyExpires: verifyExpires,
    };

    let record;
    if (userType === 'tourist') {
      record = { ...base, nationality: nationality || '', preferredLanguage: preferredLanguage || 'English' };
    } else if (userType === 'guide') {
      const isLicensed = hasMinistryLicence === true || hasMinistryLicence === 'true';
      const langArr = Array.isArray(languages) ? languages : (languages ? languages.split(',').map(s => s.trim()) : []);
      const specArr = Array.isArray(specialisations) ? specialisations : (specialisations ? specialisations.split(',').map(s => s.trim()) : []);
      const destArr = Array.isArray(destinations) ? destinations : (destinations ? destinations.split(',').map(s => s.trim()) : []);
      record = {
        ...base,
        isMinistryLicensed: isLicensed,
        licenceNumber: isLicensed ? (licenceNumber || '') : '',
        languages: langArr, specialisations: specArr, destinations: destArr,
        rating: 0, totalReviews: 0,
        pricePerDay: parseFloat(pricePerDay) || 0,
        bio: bio || '', isVerified: false, availability: [], photo: '',
      };
    } else if (userType === 'company') {
      const svcArr  = Array.isArray(companyServices)     ? companyServices     : (companyServices     ? companyServices.split(',').map(s => s.trim())     : []);
      const destArr = Array.isArray(companyDestinations) ? companyDestinations : (companyDestinations ? companyDestinations.split(',').map(s => s.trim()) : []);
      record = {
        ...base,
        companyName: companyName || '',
        companyRegNo: companyRegNo || '',
        companyServices: svcArr,
        companyDestinations: destArr,
        companyDescription: companyDescription || '',
        isVerified: false, photo: '',
      };
    } else {
      record = base;
    }

    try {
      await users.insert(record);
    } catch (insertErr) {
      // Defensive: if a column the schema doesn't have yet was added (e.g. isMinistryLicensed
      // before migration 012 has been run), drop it and retry so signup isn't blocked.
      const msg = String(insertErr?.message || '');
      const m = msg.match(/Could not find the '([^']+)' column/);
      if (m) {
        const col = m[1];
        console.warn('[register] Stripping missing column "' + col + '" and retrying');
        delete record[col];
        await users.insert(record);
      } else {
        throw insertErr;
      }
    }
    req.session.userId = record.id;
    req.session.userType = record.userType;

    // Send email verification link
    emailService.sendEmailVerification({
      email: record.email,
      name: record.fullName,
      token: verifyToken,
    }).catch(() => {});

    // Send welcome email (fire-and-forget)
    if (userType === 'tourist') {
      emailService.sendTouristWelcome({ email: record.email, name: record.fullName }).catch(() => {});
    } else if (userType === 'guide') {
      emailService.sendGuideWelcome({ email: record.email, name: record.fullName }).catch(() => {});
      emailService.sendAdminNewGuide({
        guideName: record.fullName, guideEmail: record.email,
        licenceNumber: record.licenceNumber,
        isMinistryLicensed: record.isMinistryLicensed,
        destinations: record.destinations, languages: record.languages,
      }).catch(() => {});
    } else if (userType === 'company') {
      emailService.sendCompanyWelcome({ email: record.email, name: record.fullName, companyName: record.companyName }).catch(() => {});
      emailService.sendAdminNewCompany({ companyName: record.companyName, email: record.email, companyRegNo: record.companyRegNo }).catch(() => {});
    }

    const safe = { ...record };
    delete safe.password;
    res.status(201).json({ success: true, message: 'Account created successfully.', user: safe });
  } catch (err) {
    console.error('[register] FAILED:', err?.message || err, err?.code || '');
    // Surface specific actionable errors to the user; keep generic 500 for unknown failures.
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return res.status(409).json({ success: false, message: 'Email already registered. Please log in.' });
    }
    if (msg.includes('column')) {
      return res.status(500).json({ success: false, message: 'Database schema mismatch — please contact support. (Admin: run migration 012)' });
    }
    res.status(500).json({ success: false, message: 'Server error. Please try again or contact support via WhatsApp.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await users.findByField('email', email.toLowerCase());
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    if (user.isSuspended) {
      return res.status(403).json({ success: false, message: 'Your account has been suspended. Please contact support.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // If 2FA is enabled, require the TOTP code — but only every Nth login.
    // Between prompts the user logs in with just their password. The counter
    // (loginsSince2FA) is reset to 0 each time the code is actually entered.
    if (user.twoFactorEnabled) {
      const count = user.loginsSince2FA;
      const mustPrompt = (count === null || count === undefined || count >= LOGINS_BEFORE_2FA);

      if (mustPrompt) {
        // Don't create the session yet — require the authenticator code first.
        await new Promise((resolve, reject) => {
          req.session.regenerate(err => err ? reject(err) : resolve());
        });
        req.session.pending2faUserId = user.id;
        return res.json({
          success: true,
          requires2FA: true,
          message: 'Enter your authenticator code.',
        });
      }

      // Within the trusted window — skip the code, just bump the counter.
      await users.update(user.id, { loginsSince2FA: (count || 0) + 1 }).catch(() => {});
    }

    // Regenerate session ID on login to prevent session fixation attacks
    await new Promise((resolve, reject) => {
      req.session.regenerate(err => err ? reject(err) : resolve());
    });
    req.session.userId = user.id;
    req.session.userType = user.userType;

    const safe = { ...user };
    delete safe.password;
    delete safe.twoFactorSecret;
    delete safe.twoFactorBackupCodes;
    const loginsLeft = user.twoFactorEnabled
      ? Math.max(0, LOGINS_BEFORE_2FA - ((user.loginsSince2FA || 0) + 1))
      : null;
    res.json({ success: true, message: 'Login successful.', user: safe, twoFactorLoginsLeft: loginsLeft });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Logged out.' });
  });
};

// ── Sign in with Google (tourists) ────────────────────────────────────────────
// The frontend uses Google Identity Services to obtain an ID token (credential)
// and posts it here. We verify it against our GOOGLE_CLIENT_ID, then log the
// user in — creating a tourist account on first sign-in. No password needed.
let _googleClient = null;
function getGoogleClient() {
  if (!process.env.GOOGLE_CLIENT_ID) return null;
  if (!_googleClient) {
    const { OAuth2Client } = require('google-auth-library');
    _googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return _googleClient;
}

// Shared helper: verify Google credential and upsert user
async function _resolveGoogleUser(credential) {
  const ticket = await getGoogleClient().verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  const email = (payload.email || '').toLowerCase();
  if (!email || !payload.email_verified) throw Object.assign(new Error('A verified Google email is required.'), { status: 400 });
  const fullName = payload.name || email.split('@')[0];
  const picture  = payload.picture || '';

  let user = await users.findByField('email', email);
  if (user) {
    if (user.isSuspended) throw Object.assign(new Error('This account has been suspended.'), { status: 403 });
    const patch = {};
    if (!user.googleId) patch.googleId = payload.sub;
    if (!user.emailVerified) patch.emailVerified = true;
    if (!user.photo && picture) patch.photo = picture;
    if (Object.keys(patch).length) { try { await users.update(user.id, patch); } catch (_) {} user = { ...user, ...patch }; }
  } else {
    const randomPwd = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    const record = {
      id: 'tourist-' + uuidv4().slice(0, 8),
      fullName, email, password: randomPwd,
      phone: '', userType: 'tourist',
      nationality: '', preferredLanguage: 'English',
      createdAt: new Date().toISOString(), isSuspended: false,
      emailVerified: true,
      googleId: payload.sub,
      photo: picture,
    };
    try {
      await users.insert(record);
    } catch (insertErr) {
      const m = String(insertErr?.message || '').match(/Could not find the '([^']+)' column/);
      if (m) { delete record[m[1]]; await users.insert(record); }
      else throw insertErr;
    }
    user = record;
    emailService.sendTouristWelcome({ email, name: fullName }).catch(() => {});
  }
  return user;
}

async function _saveGoogleSession(req, user) {
  await new Promise((resolve, reject) => {
    req.session.regenerate(err => err ? reject(err) : resolve());
  });
  req.session.userId   = user.id;
  req.session.userType = user.userType;
  await new Promise((resolve, reject) => {
    req.session.save(err => err ? reject(err) : resolve());
  });
}

const GOOGLE_DASH_MAP = {
  tourist: '/tourist-dashboard.html',
  guide:   '/guide-dashboard.html',
  admin:   '/admin.html',
  staff:   '/admin.html',
  company: '/company-dashboard.html',
};

// JSON API (kept for backwards compat / non-redirect browsers)
exports.googleAuth = async (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID)
      return res.status(503).json({ success: false, message: 'Google sign-in is not configured.' });
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ success: false, message: 'Missing Google credential.' });

    let user;
    try {
      user = await _resolveGoogleUser(credential);
    } catch (e) {
      return res.status(e.status || 401).json({ success: false, message: e.message || 'Invalid Google sign-in. Please try again.' });
    }

    await _saveGoogleSession(req, user);

    const safe = { ...user };
    delete safe.password;
    res.json({ success: true, message: 'Signed in with Google.', user: safe });
  } catch (err) {
    console.error('[googleAuth]', err.message);
    res.status(500).json({ success: false, message: 'Server error during Google sign-in.' });
  }
};

// Redirect-mode handler: Google POSTs credential here, we redirect to dashboard
exports.googleRedirect = async (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID)
      return res.redirect('/login.html?g_error=not_configured');

    const credential = req.body.credential;
    if (!credential) return res.redirect('/login.html?g_error=no_credential');

    let user;
    try {
      user = await _resolveGoogleUser(credential);
    } catch (e) {
      const code = e.status === 403 ? 'suspended' : 'invalid_token';
      return res.redirect(`/login.html?g_error=${code}`);
    }

    await _saveGoogleSession(req, user);
    res.redirect(GOOGLE_DASH_MAP[user.userType] || '/');
  } catch (err) {
    console.error('[googleRedirect]', err.message);
    res.redirect('/login.html?g_error=server_error');
  }
};

exports.updateProfile = async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ success: false, message: 'Not authenticated.' });
    const {
      fullName, phone, nationality, preferredLanguage,
      companyName, companyRegNo, companyServices, companyDestinations, companyDescription, packages, videoUrl,
    } = req.body;
    const changes = {};
    if (fullName)                 changes.fullName = fullName;
    if (phone !== undefined)      changes.phone = phone;
    if (nationality)              changes.nationality = nationality;
    if (preferredLanguage)        changes.preferredLanguage = preferredLanguage;
    // Company-specific fields
    if (companyName !== undefined)        changes.companyName = companyName;
    if (companyRegNo !== undefined)       changes.companyRegNo = companyRegNo;
    if (companyServices !== undefined)    changes.companyServices = companyServices;
    if (companyDestinations !== undefined)changes.companyDestinations = companyDestinations;
    if (companyDescription !== undefined) changes.companyDescription = companyDescription;
    if (packages !== undefined)           changes.packages = packages;
    if (videoUrl !== undefined)           changes.videoUrl = videoUrl;

    const updated = await users.update(req.session.userId, changes);
    if (!updated) return res.status(404).json({ success: false, message: 'User not found.' });
    const { password, ...safe } = updated;
    res.json({ success: true, message: 'Profile updated.', user: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ success: false, message: 'Not authenticated.' });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ success: false, message: 'Current password required.' });
    }
    const pwdError = validatePasswordStrength(newPassword);
    if (pwdError) {
      return res.status(400).json({ success: false, message: pwdError });
    }
    const user = await users.findById(req.session.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await users.update(req.session.userId, { password: hashed });
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

const { uploadBuffer, deleteByUrl } = require('../services/storageService');

exports.uploadPhoto = async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ success: false, message: 'Not authenticated.' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    const user = await users.findById(req.session.userId);
    if (user?.photo) deleteByUrl(user.photo).catch(() => {});

    const { url } = await uploadBuffer({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      folder: `avatars/${req.session.userId}`,
      contentType: req.file.mimetype,
    });
    await users.update(req.session.userId, { photo: url });
    res.json({ success: true, photo: url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Upload failed. Please try again.' });
  }
};

exports.me = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    const user = await users.findById(req.session.userId);
    if (!user) return res.status(401).json({ success: false, message: 'User not found.' });
    const safe = { ...user };
    delete safe.password;
    delete safe.twoFactorSecret;
    delete safe.twoFactorBackupCodes;
    res.json({ success: true, user: safe });
  } catch (e) {
    console.error('[auth:me]', e.message);
    res.status(500).json({ success: false, message: 'Failed to load user.' });
  }
};

exports.saveFcmToken = async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token required.' });
    await users.update(req.session.userId, { fcm_token: token });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const normalized = String(email).trim().toLowerCase();
    const user = await users.findByField('email', normalized);

    // Always return success to avoid email enumeration — but log server-side
    // so we can diagnose "no email arrived" reports from the Railway logs.
    if (!user) {
      console.warn(`[forgot-password] No account found for "${normalized}" — no email sent.`);
      return res.json({ success: true, message: 'If that email is registered, you will receive a reset link shortly.' });
    }

    const token = randomToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await users.update(user.id, {
      resetPasswordToken: token,
      resetPasswordExpires: expires,
    });

    // Await the send so failures are logged (the email service logs Sent/Failed).
    try {
      await emailService.sendPasswordReset({
        email: user.email,
        name: user.fullName || 'there',
        token,
      });
      console.log(`[forgot-password] Reset email dispatched to ${user.email}`);
    } catch (mailErr) {
      console.error(`[forgot-password] Failed to send reset email to ${user.email}:`, mailErr.message);
    }

    res.json({ success: true, message: 'If that email is registered, you will receive a reset link shortly.' });
  } catch (err) {
    console.error('[forgot-password]', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Reset token required.' });
    }
    const pwdError = validatePasswordStrength(newPassword);
    if (pwdError) {
      return res.status(400).json({ success: false, message: pwdError });
    }

    const user = await users.findByField('resetPasswordToken', token);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset link. Please request a new one.' });
    }
    if (!user.resetPasswordExpires || new Date(user.resetPasswordExpires) < new Date()) {
      return res.status(400).json({ success: false, message: 'Reset link has expired. Please request a new one.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await users.update(user.id, {
      password: hashed,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });

    res.json({ success: true, message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// GET /api/auth/verify-email/:token
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await users.findByField('emailVerifyToken', token);

    if (!user) {
      return res.status(400).send('<h2>Invalid verification link</h2><p>This link is invalid or has already been used.</p>');
    }
    if (user.emailVerifyExpires && new Date(user.emailVerifyExpires) < new Date()) {
      return res.status(400).send('<h2>Verification link expired</h2><p>Please request a new verification email.</p>');
    }

    await users.update(user.id, {
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpires: null,
    });

    res.send(`
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Email Verified</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:60px 20px;background:#f0f4f3">
        <h1 style="color:#0f7b6c">✓ Email Verified!</h1>
        <p>Your email has been verified. You can now use all features of Guideon.</p>
        <a href="/login.html" style="display:inline-block;margin-top:20px;background:#0f7b6c;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none">Continue to Login</a>
      </body></html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('<h2>Server error</h2><p>Please try again later.</p>');
  }
};

// POST /api/auth/resend-verification
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const user = await users.findByField('email', email.toLowerCase());
    if (!user) {
      return res.json({ success: true, message: 'If that email is registered, a verification link has been sent.' });
    }
    if (user.emailVerified) {
      return res.json({ success: true, message: 'Email is already verified.' });
    }

    const token = randomToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await users.update(user.id, {
      emailVerifyToken: token,
      emailVerifyExpires: expires,
    });

    emailService.sendEmailVerification({
      email: user.email,
      name: user.fullName,
      token,
    }).catch(() => {});

    res.json({ success: true, message: 'Verification email sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};
