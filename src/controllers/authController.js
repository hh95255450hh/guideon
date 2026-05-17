const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const email = require('../services/emailService');

const users = new SupabaseDB('users');

exports.register = async (req, res) => {
  try {
    const { fullName, email, password, userType, phone, nationality, preferredLanguage,
            licenceNumber, languages, specialisations, destinations, pricePerDay, bio } = req.body;

    if (!fullName || !email || !password || !userType) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const existing = await users.findOne(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered. Please log in.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const prefix = userType === 'guide' ? 'guide' : userType === 'admin' ? 'admin' : 'tourist';
    const id = prefix + '-' + uuidv4().slice(0, 8);

    const base = {
      id, fullName, email: email.toLowerCase(), password: hashed,
      phone: phone || '', userType,
      createdAt: new Date().toISOString(), isSuspended: false,
    };

    let record;
    if (userType === 'tourist') {
      record = { ...base, nationality: nationality || '', preferredLanguage: preferredLanguage || 'English' };
    } else if (userType === 'guide') {
      const langArr = Array.isArray(languages) ? languages : (languages ? languages.split(',').map(s => s.trim()) : []);
      const specArr = Array.isArray(specialisations) ? specialisations : (specialisations ? specialisations.split(',').map(s => s.trim()) : []);
      const destArr = Array.isArray(destinations) ? destinations : (destinations ? destinations.split(',').map(s => s.trim()) : []);
      record = {
        ...base, licenceNumber: licenceNumber || '',
        languages: langArr, specialisations: specArr, destinations: destArr,
        rating: 0, totalReviews: 0,
        pricePerDay: parseFloat(pricePerDay) || 0,
        bio: bio || '', isVerified: false, availability: [], photo: '',
      };
    } else {
      record = base;
    }

    await users.insert(record);
    req.session.userId = record.id;
    req.session.userType = record.userType;

    // Send welcome email (fire-and-forget)
    if (userType === 'tourist') {
      email.sendTouristWelcome({ email: record.email, name: record.fullName }).catch(() => {});
    } else if (userType === 'guide') {
      email.sendGuideWelcome({ email: record.email, name: record.fullName }).catch(() => {});
      email.sendAdminNewGuide({
        guideName: record.fullName, guideEmail: record.email,
        licenceNumber: record.licenceNumber,
        destinations: record.destinations, languages: record.languages,
      }).catch(() => {});
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

    const user = await users.findOne(u => u.email.toLowerCase() === email.toLowerCase());
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
  if (!req.session.userId) return res.status(401).json({ success: false, message: 'Not authenticated.' });
  const { fullName, phone, nationality, preferredLanguage } = req.body;
  const changes = {};
  if (fullName)            changes.fullName = fullName;
  if (phone !== undefined) changes.phone = phone;
  if (nationality)         changes.nationality = nationality;
  if (preferredLanguage)   changes.preferredLanguage = preferredLanguage;
  const updated = await users.update(req.session.userId, changes);
  if (!updated) return res.status(404).json({ success: false, message: 'User not found.' });
  const { password, ...safe } = updated;
  res.json({ success: true, message: 'Profile updated.', user: safe });
};

exports.changePassword = async (req, res) => {
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
};

exports.uploadPhoto = async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ success: false, message: 'Not authenticated.' });
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
  const photoUrl = '/uploads/avatars/' + req.file.filename;
  await users.update(req.session.userId, { photo: photoUrl });
  res.json({ success: true, photo: photoUrl });
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
