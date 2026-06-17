const SupabaseDB = require('../models/SupabaseDB');

const users    = new SupabaseDB('users');
const reviews  = new SupabaseDB('reviews', 'reviewId');
const bookings = new SupabaseDB('bookings');

// Simple in-memory cache so the homepage doesn't hit the DB on every visit.
const CACHE_MS = 5 * 60 * 1000;
let cache = { at: 0, data: null };

/**
 * GET /api/stats/public
 * Real, live platform statistics for the homepage strip.
 * Cached for 5 minutes.
 */
exports.publicStats = async (req, res) => {
  try {
    if (cache.data && Date.now() - cache.at < CACHE_MS) {
      return res.json({ success: true, cached: true, stats: cache.data });
    }

    // IMPORTANT: users.readAll() (select * on the whole users table) fails on
    // production — large rows over the DB link time out and return [], which
    // poisoned the cache with all-zero stats. Filtered queries (findAllWhere by
    // userType) are reliable, so fetch only the guide rows we actually need.
    const [guideRows, allReviews, allBookings] = await Promise.all([
      users.findAllWhere({ userType: 'guide' }),
      reviews.readAll(),
      bookings.readAll(),
    ]);

    // If even the guide query came back empty it almost certainly failed (the
    // platform has verified guides). Don't poison the cache — serve the last
    // good value, or a soft failure so the client keeps its fallback numbers.
    if (!guideRows.length) {
      if (cache.data) return res.json({ success: true, cached: true, stats: cache.data });
      return res.json({ success: false, stats: null });
    }

    // Certified guides: same rule the public search uses (verified, not suspended)
    const verifiedGuides = guideRows.filter(
      u => u.isVerified && !u.isSuspended
    );
    const guides = verifiedGuides.length;

    // Destinations covered: distinct destinations across verified guides
    const destSet = new Set();
    verifiedGuides.forEach(g => (g.destinations || []).forEach(d => {
      if (d && typeof d === 'string') destSet.add(d.trim().toLowerCase());
    }));
    const destinations = destSet.size;

    // Average rating across all reviews (1 decimal)
    let avgRating = null;
    if (allReviews.length) {
      const sum = allReviews.reduce((a, r) => a + (Number(r.rating) || 0), 0);
      avgRating = Math.round((sum / allReviews.length) * 10) / 10;
    }
    const reviewsCount = allReviews.length;

    // Happy tourists: distinct tourists who completed at least one booking
    const completed = allBookings.filter(b => b.status === 'completed');
    const happyTourists = new Set(completed.map(b => b.touristId).filter(Boolean)).size;

    const stats = { guides, destinations, avgRating, reviewsCount, happyTourists };
    cache = { at: Date.now(), data: stats };
    return res.json({ success: true, cached: false, stats });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not load stats.' });
  }
};
