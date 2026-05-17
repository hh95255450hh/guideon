const SupabaseDB = require('../models/SupabaseDB');

const users    = new SupabaseDB('users');
const bookings = new SupabaseDB('bookings');
const reviews  = new SupabaseDB('reviews', 'reviewId');

exports.stats = async (req, res) => {
  try {
    const allUsers    = await users.readAll();
    const allBookings = await bookings.readAll();
    const guides   = allUsers.filter(u => u.userType === 'guide');
    const tourists = allUsers.filter(u => u.userType === 'tourist');
    const revenue  = allBookings
      .filter(b => b.status !== 'cancelled')
      .reduce((s, b) => s + (b.totalAmount || 0), 0);

    res.json({
      success: true, stats: {
        totalGuides:       guides.length,
        verifiedGuides:    guides.filter(g => g.isVerified).length,
        pendingGuides:     guides.filter(g => !g.isVerified && !g.isSuspended).length,
        totalTourists:     tourists.length,
        totalBookings:     allBookings.length,
        pendingBookings:   allBookings.filter(b => b.status === 'pending').length,
        confirmedBookings: allBookings.filter(b => b.status === 'confirmed').length,
        completedBookings: allBookings.filter(b => b.status === 'completed').length,
        cancelledBookings: allBookings.filter(b => b.status === 'cancelled').length,
        totalRevenue:      Math.round(revenue * 100) / 100,
        guideRatings:      guides.map(g => g.rating || 0),
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

exports.verifyGuide = async (req, res) => {
  try {
    const { id } = req.params;
    const guide = await users.findById(id);
    if (!guide || guide.userType !== 'guide') {
      return res.status(404).json({ success: false, message: 'Guide not found.' });
    }
    await users.update(id, { isVerified: true });
    res.json({ success: true, message: `${guide.fullName} has been verified and is now visible in search results.` });
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
