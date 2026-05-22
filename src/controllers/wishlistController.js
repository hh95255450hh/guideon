const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');

const shared = new SupabaseDB('shared_wishlists');
const users  = new SupabaseDB('users');

// POST /api/wishlist/share — create a shareable wishlist from guide IDs
exports.share = async (req, res) => {
  try {
    const { guideIds, title } = req.body;
    if (!Array.isArray(guideIds) || guideIds.length === 0) {
      return res.status(400).json({ success: false, message: 'guideIds array is required.' });
    }
    const owner = await users.findById(req.session.userId);
    const record = {
      id: 'wl-' + uuidv4().slice(0, 10),
      ownerId: req.session.userId,
      ownerName: owner?.fullName || 'A traveler',
      guideIds: guideIds.slice(0, 50),
      title: title || `${owner?.fullName || 'My'}'s favorite Oman guides`,
      createdAt: new Date().toISOString(),
    };
    const inserted = await shared.insert(record);
    res.status(201).json({
      success: true,
      shareUrl: `${process.env.APP_URL || 'https://guideon.guide'}/shared-wishlist.html?id=${inserted.id}`,
      wishlist: inserted,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Could not share wishlist.' });
  }
};

// GET /api/wishlist/:id — fetch a shared wishlist (public)
exports.get = async (req, res) => {
  try {
    const wl = await shared.findById(req.params.id);
    if (!wl) return res.status(404).json({ success: false, message: 'Wishlist not found.' });

    const guides = await Promise.all(
      (wl.guideIds || []).map(id => users.findById(id))
    );

    const safe = guides
      .filter(g => g && g.userType === 'guide' && g.isVerified && !g.isSuspended)
      .map(({ password, emailVerifyToken, resetPasswordToken, fcm_token, ...g }) => g);

    res.json({ success: true, wishlist: { ...wl, guides: safe } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
