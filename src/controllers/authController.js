const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const emailService = require('../services/emailService');

const users = new SupabaseDB('users');

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
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
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
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

    await users.insert(record);
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
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
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

    req.session.userId = user.id;
    req.session.userType = user.userType;

    const safe = { ...user };
    delete safe.password;
    res.json({ success: true, message: 'Login successful.', user: safe });
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
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Invalid password data.' });
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
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }
  const user = await users.findById(req.session.userId);
  if (!user) return res.status(401).json({ success: false, message: 'User not found.' });
  const safe = { ...user };
  delete safe.password;
  res.json({ success: true, user: safe });
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

    const user = await users.findByField('email', email.toLowerCase());
    // Always return success to avoid email enumeration
    if (!user) {
      return res.json({ success: true, message: 'If that email is registered, you will receive a reset link shortly.' });
    }

    const token = randomToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await users.update(user.id, {
      resetPasswordToken: token,
      resetPasswordExpires: expires,
    });

    emailService.sendPasswordReset({
      email: user.email,
      name: user.fullName,
      token,
    }).catch(() => {});

    res.json({ success: true, message: 'If that email is registered, you will receive a reset link shortly.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Token and new password (min 8 chars) are required.' });
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
