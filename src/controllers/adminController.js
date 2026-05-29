const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const email = require('../services/emailService');
const audit = require('../services/auditService');
const { ROLES, PERMISSIONS, getEffectivePermissions } = require('../config/permissions');

const users    = new SupabaseDB('users');
const bookings = new SupabaseDB('bookings');
const reviews  = new SupabaseDB('reviews', 'reviewId');
const messages    = new SupabaseDB('messages');
const auditLog    = new SupabaseDB('admin_audit_log');

// CSV helper: convert array of objects to CSV
function toCSV(rows, columns) {
  if (!rows?.length) return '';
  const cols = columns || Object.keys(rows[0]);
  const escape = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map(r => cols.map(c => escape(r[c])).join(','))].join('\n');
}

// GET /api/admin/stats/extended — richer analytics
exports.extendedStats = async (req, res) => {
  try {
    const [allUsers, allBookings, allReviews] = await Promise.all([
      users.readAll(),
      bookings.readAll(),
      reviews.readAll(),
    ]);

    // Bookings per guide (top 10)
    const guideBookings = {};
    for (const b of allBookings) {
      if (b.status === 'cancelled') continue;
      guideBookings[b.guideId] = (guideBookings[b.guideId] || 0) + 1;
    }
    const guideIdToName = Object.fromEntries(allUsers.filter(u => u.userType === 'guide').map(g => [g.id, g.fullName]));
    const topGuides = Object.entries(guideBookings)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ id, name: guideIdToName[id] || 'Unknown', bookings: count }));

    // Bookings per destination (top 10)
    const destCount = {};
    for (const b of allBookings) {
      if (!b.destination) continue;
      destCount[b.destination] = (destCount[b.destination] || 0) + 1;
    }
    const topDestinations = Object.entries(destCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([destination, count]) => ({ destination, count }));

    // Revenue by month (last 12 months)
    const now = new Date();
    const monthly = {};
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = 0;
    }
    for (const b of allBookings) {
      if (b.status === 'cancelled' || !b.createdAt) continue;
      const d = new Date(b.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key in monthly) monthly[key] += (b.totalAmount || 0);
    }
    const revenueByMonth = Object.entries(monthly).reverse().map(([month, revenue]) => ({ month, revenue: Math.round(revenue * 100) / 100 }));

    // Bookings status timeline (last 30 days)
    const last30 = new Date(); last30.setDate(last30.getDate() - 30);
    const recentBookings = allBookings.filter(b => b.createdAt && new Date(b.createdAt) >= last30);

    // Average rating
    const avgRating = allReviews.length
      ? Math.round((allReviews.reduce((s, r) => s + (r.rating || 0), 0) / allReviews.length) * 100) / 100
      : 0;

    // New users last 7 days
    const last7 = new Date(); last7.setDate(last7.getDate() - 7);
    const newUsersWeek = allUsers.filter(u => u.createdAt && new Date(u.createdAt) >= last7).length;

    res.json({
      success: true,
      data: {
        topGuides,
        topDestinations,
        revenueByMonth,
        recentBookingsCount: recentBookings.length,
        avgRating,
        totalReviews: allReviews.length,
        newUsersWeek,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

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
    audit.logAction(req, { action: 'verifyGuide', targetType: 'user', targetId: id, details: { name: guide.fullName } });
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
    audit.logAction(req, { action: 'verifyCompany', targetType: 'user', targetId: id, details: { name: company.companyName } });
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
    audit.logAction(req, { action: 'suspendUser', targetType: 'user', targetId: id, details: { name: user.fullName, reason: req.body?.reason } });
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
    audit.logAction(req, { action: 'unsuspendUser', targetType: 'user', targetId: id, details: { name: user.fullName } });
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
    audit.logAction(req, { action: 'createAdmin', targetType: 'user', targetId: record.id, details: { name: fullName, email: adminEmail } });
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
    audit.logAction(req, { action: 'deleteUser', targetType: 'user', targetId: id, details: { name: user.fullName, email: user.email } });
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
    audit.logAction(req, { action: 'markBookingComplete', targetType: 'booking', targetId: id });
    res.json({ success: true, message: 'Booking marked as completed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════════════════════════════════════════════════════════════════════
//  NEW ADMIN POWERS
// ════════════════════════════════════════════════════════════════════

// PATCH /api/admin/users/:id — edit any user's profile fields
exports.editUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await users.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Allowlist of editable fields (never expose password/tokens via this endpoint)
    const allowed = ['fullName', 'email', 'phone', 'nationality', 'preferredLanguage',
      'pricePerDay', 'bio', 'languages', 'specialisations', 'destinations', 'isVerified',
      'isMinistryLicensed', 'licenceNumber', 'companyName', 'companyRegNo',
      'companyServices', 'companyDestinations', 'companyDescription', 'photo'];

    const changes = {};
    const before = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        before[field] = user[field];
        changes[field] = req.body[field];
      }
    }
    if (req.body.email) changes.email = req.body.email.toLowerCase();
    if (req.body.pricePerDay !== undefined) changes.pricePerDay = parseFloat(req.body.pricePerDay) || 0;

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ success: false, message: 'No changes provided.' });
    }

    const updated = await users.update(id, changes);
    audit.logAction(req, {
      action: 'editUser', targetType: 'user', targetId: id,
      details: { before, after: changes },
    });
    const { password, resetPasswordToken, emailVerifyToken, ...safe } = updated;
    res.json({ success: true, message: 'User updated.', user: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/admin/users/:id/reset-password — admin resets a user's password
exports.adminResetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }
    const user = await users.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await users.update(id, { password: hashed });
    audit.logAction(req, { action: 'adminResetPassword', targetType: 'user', targetId: id, details: { name: user.fullName } });
    res.json({ success: true, message: `Password reset for ${user.fullName}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/admin/bookings/:id/cancel — admin override cancellation
exports.adminCancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Cancellation reason required (min 3 chars).' });
    }

    const booking = await bookings.findById(id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (booking.status === 'cancelled') return res.status(400).json({ success: false, message: 'Already cancelled.' });

    await bookings.update(id, {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledBy: req.session.userId,
      cancelledAt: new Date().toISOString(),
    });

    // Restore date to guide availability
    const guide = await users.findById(booking.guideId);
    if (guide) {
      const avail = Array.isArray(guide.availability) ? guide.availability : [];
      if (!avail.includes(booking.tourDate)) {
        await users.update(booking.guideId, { availability: [...avail, booking.tourDate] });
      }
    }

    // Notify both parties
    const tourist = await users.findById(booking.touristId);
    const emailData = {
      destination: booking.destination, tourDate: booking.tourDate,
      totalAmount: booking.totalAmount, bookingId: id,
    };
    if (tourist) email.sendTouristBookingCancelled({ email: tourist.email, name: tourist.fullName, guideName: guide?.fullName, ...emailData }).catch(() => {});
    if (guide)   email.sendGuideBookingCancelled({ email: guide.email, name: guide.fullName, touristName: tourist?.fullName, ...emailData }).catch(() => {});

    audit.logAction(req, { action: 'adminCancelBooking', targetType: 'booking', targetId: id, details: { reason } });
    res.json({ success: true, message: 'Booking cancelled.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/admin/broadcast — send email to all users in a group
exports.broadcastEmail = async (req, res) => {
  try {
    const { audience, subject, message } = req.body;
    const validAudiences = ['all', 'tourist', 'guide', 'company'];
    if (!validAudiences.includes(audience)) {
      return res.status(400).json({ success: false, message: 'Invalid audience.' });
    }
    if (!subject || !message || subject.trim().length < 3 || message.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Subject and message required.' });
    }

    let recipients;
    if (audience === 'all') {
      const all = await users.readAll();
      recipients = all.filter(u => u.userType !== 'admin' && !u.isSuspended);
    } else {
      recipients = await users.findAllByField('userType', audience);
      recipients = recipients.filter(u => !u.isSuspended);
    }

    // Send in chunks of 20 to respect rate limits
    const safeSubject = subject.trim();
    const safeMessage = message.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ''); // strip script tags
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
        <div style="background:white;padding:40px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.08)">
          <h2 style="color:#0f7b6c;margin:0 0 20px">${safeSubject}</h2>
          <div style="font-size:15px;line-height:1.7;color:#333;white-space:pre-wrap">${safeMessage}</div>
          <hr style="margin:32px 0;border:none;border-top:1px solid #eee">
          <p style="font-size:12px;color:#999;text-align:center;margin:0">Sent from Guideon admin · You can reply to this email.</p>
        </div>
      </div>`;

    let sent = 0, failed = 0;
    for (const u of recipients) {
      try {
        await email.send(u.email, safeSubject, html);
        sent++;
      } catch { failed++; }
    }

    audit.logAction(req, {
      action: 'broadcastEmail', targetType: 'audience', targetId: audience,
      details: { subject: safeSubject, recipients: recipients.length, sent, failed },
    });
    res.json({ success: true, message: `Sent to ${sent} recipients (${failed} failed).`, sent, failed, total: recipients.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/admin/reviews/:id — remove inappropriate review
exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await reviews.findById(id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });

    await reviews.delete(id);

    // Recalculate guide's rating
    const guideReviews = await reviews.findAllByField('guideId', review.guideId);
    const avg = guideReviews.length ? guideReviews.reduce((s, r) => s + r.rating, 0) / guideReviews.length : 0;
    await users.update(review.guideId, {
      rating: Math.round(avg * 10) / 10,
      totalReviews: guideReviews.length,
    });

    audit.logAction(req, { action: 'deleteReview', targetType: 'review', targetId: id, details: { reason: req.body?.reason } });
    res.json({ success: true, message: 'Review deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/admin/messages/:id — remove inappropriate message
exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    try {
      await messages.delete(id);
    } catch (e) { return res.status(404).json({ success: false, message: 'Message not found or already deleted.' }); }
    audit.logAction(req, { action: 'deleteMessage', targetType: 'message', targetId: id, details: { reason: req.body?.reason } });
    res.json({ success: true, message: 'Message deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/audit-log?limit=100&action=verifyGuide
exports.getAuditLog = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const all = await auditLog.readAll();
    let filtered = all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (req.query.action) filtered = filtered.filter(a => a.action === req.query.action);
    if (req.query.adminId) filtered = filtered.filter(a => a.adminId === req.query.adminId);
    res.json({ success: true, entries: filtered.slice(0, limit), total: filtered.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/export/:resource — CSV export
exports.exportCSV = async (req, res) => {
  try {
    const { resource } = req.params;
    let rows, filename, columns;

    switch (resource) {
      case 'users':
        rows = await users.readAll();
        rows = rows.map(({ password, resetPasswordToken, emailVerifyToken, ...r }) => r);
        columns = ['id', 'fullName', 'email', 'phone', 'userType', 'nationality', 'isVerified', 'isSuspended', 'emailVerified', 'createdAt'];
        filename = 'guideon-users.csv';
        break;
      case 'bookings':
        rows = await bookings.readAll();
        columns = ['id', 'touristId', 'guideId', 'destination', 'tourDate', 'duration', 'participants', 'totalAmount', 'status', 'isPaid', 'createdAt'];
        filename = 'guideon-bookings.csv';
        break;
      case 'reviews':
        rows = await reviews.readAll();
        columns = ['reviewId', 'guideId', 'touristId', 'rating', 'comment', 'createdAt'];
        filename = 'guideon-reviews.csv';
        break;
      case 'audit-log':
        rows = await auditLog.readAll();
        rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        columns = ['id', 'adminId', 'adminName', 'action', 'targetType', 'targetId', 'ip', 'createdAt'];
        filename = 'guideon-audit-log.csv';
        break;
      default:
        return res.status(400).json({ success: false, message: 'Unknown resource. Use: users, bookings, reviews, audit-log' });
    }

    audit.logAction(req, { action: 'exportCSV', targetType: 'resource', targetId: resource });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + toCSV(rows, columns)); // BOM for Excel UTF-8 support
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ════════════════════════════════════════════════════════════════════
//  STAFF MANAGEMENT (super admin only)
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/staff — list all staff members
exports.allStaff = async (req, res) => {
  try {
    const staff = await users.findAllByField('userType', 'staff');
    const safe = staff.map(({ password, resetPasswordToken, emailVerifyToken, ...s }) => s);
    res.json({ success: true, staff: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/staff/roles — list available role templates
exports.staffRoles = (req, res) => {
  const roles = Object.entries(ROLES).map(([key, r]) => ({
    key,
    label: r.label,
    description: r.description,
    permissions: r.permissions,
  }));
  const allPerms = Object.entries(PERMISSIONS).map(([key, value]) => ({ key, value }));
  res.json({ success: true, roles, permissions: allPerms });
};

// POST /api/admin/staff — create a new staff member
exports.createStaff = async (req, res) => {
  try {
    const { fullName, email: staffEmail, password, phone, role, customPermissions } = req.body;

    if (!fullName || !staffEmail || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }

    // Resolve permissions: role template OR custom list
    let permissions;
    if (role && ROLES[role]) {
      permissions = ROLES[role].permissions;
    } else if (Array.isArray(customPermissions)) {
      permissions = customPermissions.filter(p => Object.values(PERMISSIONS).includes(p));
    } else {
      return res.status(400).json({ success: false, message: 'Either role or customPermissions required.' });
    }

    const existing = await users.findByField('email', staffEmail.toLowerCase());
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const record = {
      id: 'staff-' + uuidv4().slice(0, 8),
      fullName,
      email: staffEmail.toLowerCase(),
      password: hashed,
      phone: phone || '',
      userType: 'staff',
      staffRole: role || 'custom',
      permissions,
      isVerified: true,
      isSuspended: false,
      emailVerified: true,
      createdBy: req.session.userId,
      createdAt: new Date().toISOString(),
    };

    await users.insert(record);
    audit.logAction(req, {
      action: 'createStaff', targetType: 'user', targetId: record.id,
      details: { name: fullName, email: staffEmail, role: role || 'custom', permissions },
    });

    // Welcome email with credentials
    email.send(staffEmail, '🎉 Welcome to Guideon Team',
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px">
        <div style="background:white;border-radius:12px;padding:40px;box-shadow:0 4px 16px rgba(0,0,0,0.08)">
          <h2 style="color:#0f7b6c">Welcome to the Guideon Team, ${fullName}! 👋</h2>
          <p>You've been added as <strong>${ROLES[role]?.label || 'Staff'}</strong>.</p>
          <div style="background:#e8f5f2;padding:16px;border-radius:8px;margin:20px 0">
            <strong>Your login credentials:</strong><br>
            Email: <code>${staffEmail}</code><br>
            Password: <code>${password}</code><br>
            <em style="font-size:.85em;color:#666">Please change your password after first login.</em>
          </div>
          <p>Sign in here: <a href="${process.env.APP_URL || 'https://www.guideon.om'}/login.html">${process.env.APP_URL || 'https://www.guideon.om'}/login.html</a></p>
        </div>
      </div>`
    ).catch(() => {});

    const { password: _, ...safe } = record;
    res.status(201).json({ success: true, message: `Staff account created for ${fullName}.`, staff: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/admin/staff/:id — update staff role / permissions
exports.updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone, role, customPermissions, isSuspended } = req.body;

    const staff = await users.findById(id);
    if (!staff || staff.userType !== 'staff') {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    const changes = {};
    if (fullName !== undefined) changes.fullName = fullName;
    if (phone !== undefined)    changes.phone = phone;
    if (isSuspended !== undefined) changes.isSuspended = !!isSuspended;
    if (role && ROLES[role]) {
      changes.staffRole = role;
      changes.permissions = ROLES[role].permissions;
    } else if (Array.isArray(customPermissions)) {
      changes.staffRole = 'custom';
      changes.permissions = customPermissions.filter(p => Object.values(PERMISSIONS).includes(p));
    }

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ success: false, message: 'No changes provided.' });
    }

    const updated = await users.update(id, changes);
    audit.logAction(req, { action: 'updateStaff', targetType: 'user', targetId: id, details: changes });
    const { password, ...safe } = updated;
    res.json({ success: true, message: 'Staff member updated.', staff: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/admin/staff/:id — remove a staff account
exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await users.findById(id);
    if (!staff || staff.userType !== 'staff') {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }
    await users.delete(id);
    audit.logAction(req, { action: 'deleteStaff', targetType: 'user', targetId: id, details: { name: staff.fullName, email: staff.email } });
    res.json({ success: true, message: `${staff.fullName} has been removed from staff.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/admin/me/permissions — current user's effective permissions
exports.myPermissions = (req, res) => {
  if (!req.user) return res.status(401).json({ success: false });
  const perms = getEffectivePermissions(req.user);
  res.json({
    success: true,
    userType: req.user.userType,
    staffRole: req.user.staffRole || null,
    permissions: perms,
    isSuperAdmin: req.user.userType === 'admin',
  });
};
