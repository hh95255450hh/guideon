const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const email = require('../services/emailService');

const users    = new SupabaseDB('users');
const bookings = new SupabaseDB('bookings');
const reviews  = new SupabaseDB('reviews', 'reviewId');

exports.stats = async (req, res) => {
  try {
    const allUsers    = await users.readAll();
    const allBookings = await bookings.readAll();
    const guides    = allUsers.filter(u => u.userType === 'guide');
    const tourists  = allUsers.filter(u => u.userType === 'tourist');
    const companies = allUsers.filter(u => u.userType === 'company');
    const revenue   = allBookings
      .filter(b => b.status !== 'cancelled')
      .reduce((s, b) => s + (b.totalAmount || 0), 0);

    res.json({
      success: true, stats: {
        totalGuides:         guides.length,
        verifiedGuides:      guides.filter(g => g.isVerified).length,
        pendingGuides:       guides.filter(g => !g.isVerified && !g.isSuspended).length,
        licensedGuides:      guides.filter(g => g.isMinistryLicensed).length,
        unlicensedGuides:    guides.filter(g => !g.isMinistryLicensed).length,
        totalTourists:       tourists.length,
        totalCompanies:      companies.length,
        verifiedCompanies:   companies.filter(c => c.isVerified).length,
        pendingCompanies:    companies.filter(c => !c.isVerified && !c.isSuspended).length,
        totalBookings:       allBookings.length,
        pendingBookings:     allBookings.filter(b => b.status === 'pending').length,
        confirmedBookings:   allBookings.filter(b => b.status === 'confirmed').length,
        completedBookings:   allBookings.filter(b => b.status === 'completed').length,
        cancelledBookings:   allBookings.filter(b => b.status === 'cancelled').length,
        totalRevenue:        Math.round(revenue * 100) / 100,
        guideRatings:        guides.map(g => g.rating || 0),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.pendingGuides = async (req, res) => {
  try {
    const pending = await users.findAll(u => u.userType === 'guide' && !u.isVerified && !u.isSuspended);
    res.json({ success: true, guides: pending.map(({ password, ...g }) => g) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.allGuides = async (req, res) => {
  try {
    const guides = await users.findAll(u => u.userType === 'guide');
    res.json({ success: true, guides: guides.map(({ password, ...g }) => g) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.allTourists = async (req, res) => {
  try {
    const tourists = await users.findAll(u => u.userType === 'tourist');
    res.json({ success: true, tourists: tourists.map(({ password, ...t }) => t) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.allCompanies = async (req, res) => {
  try {
    const companies = await users.findAll(u => u.userType === 'company');
    res.json({ success: true, companies: companies.map(({ password, ...c }) => c) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.pendingCompanies = async (req, res) => {
  try {
    const pending = await users.findAll(u => u.userType === 'company' && !u.isVerified && !u.isSuspended);
    res.json({ success: true, companies: pending.map(({ password, ...c }) => c) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.verifyGuide = async (req, res) => {
  try {
    const { id } = req.params;
    const guide = await users.findById(id);
    if (!guide || guide.userType !== 'guide') {
      return res.status(404).json({ success: false, message: 'Guide not found.' });
    }
    await users.update(id, { isVerified: true });
    email.sendGuideVerified({ email: guide.email, name: guide.fullName }).catch(() => {});
    res.json({ success: true, message: `${guide.fullName} has been verified and is now visible in search results.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.verifyCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await users.findById(id);
    if (!company || company.userType !== 'company') {
      return res.status(404).json({ success: false, message: 'Company not found.' });
    }
    await users.update(id, { isVerified: true });
    email.sendCompanyVerified({ email: company.email, name: company.fullName, companyName: company.companyName }).catch(() => {});
    res.json({ success: true, message: `${company.companyName} has been approved and is now listed on the platform.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.suspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await users.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    await users.update(id, { isSuspended: true, isVerified: false });
    res.json({ success: true, message: `${user.fullName}'s account has been suspended.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.unsuspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await users.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    await users.update(id, { isSuspended: false });
    res.json({ success: true, message: `${user.fullName}'s account has been reactivated.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.allBookings = async (req, res) => {
  try {
    const list = await bookings.readAll();
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const enriched = await Promise.all(list.map(async b => {
      const guide   = await users.findById(b.guideId);
      const tourist = await users.findById(b.touristId);
      return {
        ...b,
        guideName:    guide   ? guide.fullName   : 'Unknown',
        touristName:  tourist ? tourist.fullName  : 'Unknown',
        touristEmail: tourist ? tourist.email     : '',
      };
    }));
    res.json({ success: true, bookings: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/admin/create-admin — only existing admins can create new admins
exports.createAdmin = async (req, res) => {
  try {
    const { fullName, email: adminEmail, password, phone } = req.body;

    if (!fullName || !adminEmail || !password) {
      return res.status(400).json({ success: false, message: 'fullName, email and password are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const existing = await users.findByField('email', adminEmail.toLowerCase());
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const record = {
      id: 'admin-' + uuidv4().slice(0, 8),
      fullName,
      email: adminEmail.toLowerCase(),
      password: hashed,
      phone: phone || '',
      userType: 'admin',
      isVerified: true,
      isSuspended: false,
      emailVerified: true,
      createdAt: new Date().toISOString(),
    };

    await users.insert(record);
    const { password: _, ...safe } = record;
    res.status(201).json({ success: true, message: `Admin account created for ${fullName}.`, user: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/admin/users/:id — permanently delete a user (admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.session.userId) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }
    const user = await users.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    await users.delete(id);
    res.json({ success: true, message: `${user.fullName} has been permanently deleted.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/admins — list all admin accounts
exports.allAdmins = async (req, res) => {
  try {
    const admins = await users.findAllByField('userType', 'admin');
    res.json({ success: true, admins: admins.map(({ password, ...a }) => a) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.markBookingComplete = async (req, res) => {
  try {
    const { id } = req.params;
    const b = await bookings.findById(id);
    if (!b) return res.status(404).json({ success: false, message: 'Booking not found.' });
    await bookings.update(id, { status: 'completed' });
    res.json({ success: true, message: 'Booking marked as completed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
