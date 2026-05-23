const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');

const views    = new SupabaseDB('tour_views');
const packages = new SupabaseDB('tour_packages');
const bookings = new SupabaseDB('bookings');
const reviews  = new SupabaseDB('reviews', 'reviewId');
const payouts  = new SupabaseDB('guide_payouts');
const users    = new SupabaseDB('users');

// POST /api/packages/:id/view — record a page view
exports.recordView = async (req, res) => {
  try {
    const { id } = req.params;
    const pkg = await packages.findById(id);
    if (!pkg) return res.status(404).json({ success: false });

    await views.insert({
      id: 'v-' + uuidv4().slice(0, 12),
      packageId: id,
      guideId: pkg.providerType === 'guide' ? pkg.providerId : null,
      viewerId: req.session?.userId || null,
      viewerIp: req.ip || req.headers['x-forwarded-for']?.split(',')[0] || null,
      createdAt: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false }); // silently fail — never block the page
  }
};

// GET /api/guide/analytics — analytics for the logged-in guide
exports.guideAnalytics = async (req, res) => {
  try {
    const guideId = req.session.userId;
    if (req.session.userType !== 'guide') {
      return res.status(403).json({ success: false, message: 'Guide only.' });
    }

    const [myPackages, myBookings, myReviews, myViews] = await Promise.all([
      packages.findAllByField('providerId', guideId),
      bookings.findAllByField('guideId', guideId),
      reviews.findAllByField('guideId', guideId),
      views.findAllByField('guideId', guideId),
    ]);

    // Per-tour stats
    const perTour = myPackages.map(p => {
      const tourViews    = myViews.filter(v => v.packageId === p.id).length;
      const tourBookings = myBookings.filter(b => b.packageId === p.id).length;
      const conversion   = tourViews > 0 ? (tourBookings / tourViews * 100) : 0;
      return {
        id: p.id,
        title: p.title,
        destination: p.destination,
        isPublished: p.isPublished,
        views: tourViews,
        bookings: tourBookings,
        conversion: Math.round(conversion * 10) / 10,
      };
    });

    // Last 30 days bookings
    const last30 = new Date(); last30.setDate(last30.getDate() - 30);
    const recentBookings = myBookings.filter(b => b.createdAt && new Date(b.createdAt) >= last30);

    // Last 30 days views
    const recentViews = myViews.filter(v => v.createdAt && new Date(v.createdAt) >= last30);

    // Earnings
    const completedBookings = myBookings.filter(b => b.status === 'completed');
    const totalEarned = completedBookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const pendingEarnings = myBookings.filter(b => b.status === 'confirmed' || b.status === 'in_progress')
      .reduce((s, b) => s + (b.totalAmount || 0), 0);

    res.json({
      success: true,
      data: {
        totalPackages: myPackages.length,
        publishedPackages: myPackages.filter(p => p.isPublished).length,
        totalViews: myViews.length,
        viewsLast30: recentViews.length,
        totalBookings: myBookings.length,
        bookingsLast30: recentBookings.length,
        completedBookings: completedBookings.length,
        totalEarned: Math.round(totalEarned * 100) / 100,
        pendingEarnings: Math.round(pendingEarnings * 100) / 100,
        avgRating: myReviews.length
          ? Math.round((myReviews.reduce((s, r) => s + r.rating, 0) / myReviews.length) * 10) / 10
          : 0,
        totalReviews: myReviews.length,
        overallConversion: myViews.length > 0
          ? Math.round((myBookings.length / myViews.length * 100) * 10) / 10
          : 0,
        perTour: perTour.sort((a, b) => b.bookings - a.bookings),
        achievements: computeAchievements({ myPackages, myBookings, myReviews, myViews }),
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false });
  }
};

// GET /api/guide/payouts — list payouts for the logged-in guide
exports.guidePayouts = async (req, res) => {
  try {
    const guideId = req.session.userId;
    const myPayouts = await payouts.findAllByField('guideId', guideId);
    myPayouts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalPaid    = myPayouts.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0);
    const totalPending = myPayouts.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0);

    res.json({
      success: true,
      data: {
        payouts: myPayouts,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalPending: Math.round(totalPending * 100) / 100,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false });
  }
};

// ─── ACHIEVEMENTS COMPUTATION ─────────────────────────────────
// Computed dynamically — no DB storage needed
function computeAchievements({ myPackages, myBookings, myReviews, myViews }) {
  const completed = myBookings.filter(b => b.status === 'completed').length;
  const avgRating = myReviews.length
    ? myReviews.reduce((s, r) => s + r.rating, 0) / myReviews.length
    : 0;
  const fiveStars = myReviews.filter(r => r.rating === 5).length;

  const badges = [
    { id: 'first_tour',      label: 'First Tour Created',  icon: '🗺️',  earned: myPackages.length >= 1,  description: 'Created your first tour' },
    { id: 'first_booking',   label: 'First Booking',        icon: '🎉',  earned: myBookings.length >= 1,  description: 'Received your first booking' },
    { id: 'first_completed', label: 'First Trip Completed', icon: '🏁',  earned: completed >= 1,          description: 'Completed your first trip' },
    { id: 'first_review',    label: 'First Review',         icon: '⭐',  earned: myReviews.length >= 1,   description: 'Got your first review' },
    { id: 'first_5star',     label: 'Perfect Rating',       icon: '🌟',  earned: fiveStars >= 1,          description: 'Earned a 5-star review' },
    { id: 'ten_bookings',    label: '10 Bookings',          icon: '🔟',  earned: myBookings.length >= 10, description: 'Reached 10 bookings' },
    { id: 'fifty_bookings',  label: '50 Bookings',          icon: '💎',  earned: myBookings.length >= 50, description: 'Reached 50 bookings' },
    { id: 'hundred_bookings',label: '100 Bookings Master',  icon: '🏆',  earned: myBookings.length >= 100, description: 'Reached 100 bookings' },
    { id: 'top_rated',       label: 'Top Rated Guide',      icon: '👑',  earned: avgRating >= 4.7 && myReviews.length >= 5, description: '4.7+ rating with 5+ reviews' },
    { id: 'popular',         label: 'Popular',              icon: '🔥',  earned: myViews.length >= 100,   description: '100+ tour page views' },
    { id: 'multi_tours',     label: 'Versatile Guide',      icon: '🎨',  earned: myPackages.length >= 5,  description: 'Offering 5+ different tours' },
    { id: 'storyteller',     label: 'Master Storyteller',   icon: '📚',  earned: myReviews.length >= 20,  description: '20+ reviews collected' },
  ];

  return badges;
}
