const SupabaseDB = require('../models/SupabaseDB');
const { sanitizeContact } = require('../utils/sanitizeContact');

const users    = new SupabaseDB('users');
const reviews  = new SupabaseDB('reviews', 'reviewId');
const packages = new SupabaseDB('tour_packages');
const bookings = new SupabaseDB('bookings');

exports.searchGuides = async (req, res) => {
  try {
    const { destination, governorate, language, date, specialisation, minRating, sortBy, minPrice, maxPrice } = req.query;
    // Pagination — public API: ?page=1&pageSize=24
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize) || 24, 1), 60);
    const page     = Math.max(parseInt(req.query.page) || 1, 1);

    // Fetch verified, non-suspended guides with a single server-side
    // equality filter (reliable across all rows), then apply the
    // array/text/range filters + sort + pagination in JS. At GUIDEON's
    // current scale this is well within memory; correctness first.
    //
    // (A previous attempt pushed ordering + count:'exact' to Postgres via
    // findPage, but that path returned 0 rows on production data — the
    // server-side .order() made the query fail and silently empty the
    // result. Reverted to the proven findAllWhere fetch below.)
    let guides = await users.findAllWhere({ userType: 'guide', isVerified: true, isSuspended: false });

    if (destination) {
      guides = guides.filter(g => (g.destinations || []).some(d => d.toLowerCase().includes(destination.toLowerCase())));
    }
    // Governorate-level filter: match guides whose destination list contains
    // ANY wilayat from that governorate.
    if (governorate) {
      const govWilayats = {
        'Muscat':              ['Muscat','Muttrah','Bawshar','As Seeb','Al Amerat','Qurayyat'],
        'Dhofar':              ['Salalah','Taqah','Mirbat','Thumrait','Sadah','Rakhyut','Dhalkut','Shaleem','Al Mazyona'],
        'Musandam':            ['Khasab','Bukha','Dibba','Madha','Musandam'],
        'Al Buraimi':          ['Al Buraimi','Buraimi','Mahdah','As Sunaynah'],
        'Ad Dakhiliyah':       ['Nizwa','Bahla','Manah','Al Hamra','Adam','Izki','Samail','Bidbid','Jabal Akhdar','Jabal Al Akhdar'],
        'Al Batinah North':    ['Sohar','Shinas','Liwa','Saham','Al Khaburah','As Suwayq'],
        'Al Batinah South':    ['Rustaq','Al Awabi','Nakhal','Wadi Al Maawil','Barka','Al Masnaah'],
        'Ash Sharqiyah North': ['Ibra','Al Mudhaibi','Bidiyah','Al Qabil','Wadi Bani Khalid','Dima','Wadi Shab'],
        'Ash Sharqiyah South': ['Sur','Al Kamil','Jalan','Masirah','Ras al-Jinz','Ras al Jinz'],
        'Ad Dhahirah':         ['Ibri','Yanqul','Dhank'],
        'Al Wusta':            ['Haima','Mahut','Duqm','Al Jazer','Wahiba'],
      };
      const targets = govWilayats[governorate] || [];
      guides = guides.filter(g => (g.destinations || []).some(d => {
        const dl = d.toLowerCase();
        return targets.some(t => dl.includes(t.toLowerCase()));
      }));
    }
    if (language) {
      guides = guides.filter(g => (g.languages || []).some(l => l.toLowerCase().includes(language.toLowerCase())));
    }
    if (date) {
      guides = guides.filter(g => (g.availability || []).includes(date));
    }
    if (specialisation) {
      const spec = specialisation.toLowerCase();
      // Match guides whose specialisations list contains the term...
      let matched = guides.filter(g => (g.specialisations || []).some(s => s.toLowerCase().includes(spec)));
      // ...OR who have at least one published tour package in that category
      try {
        let tours = [];
        try { tours = await packages.findAllByField('isPublished', true); } catch {}
        const guidesWithCat = new Set(tours
          .filter(t => {
            if (t.category && t.category.toLowerCase().includes(spec)) return true;
            if (Array.isArray(t.categories) && t.categories.some(c => (c || '').toLowerCase().includes(spec))) return true;
            return false;
          })
          .map(t => t.providerId));
        const byTours = guides.filter(g => guidesWithCat.has(g.id));
        const ids = new Set(matched.map(g => g.id));
        for (const g of byTours) if (!ids.has(g.id)) matched.push(g);
      } catch (e) { /* if packages table missing, fall back to specialisations only */ }
      guides = matched;
    }

    // Rating + price range filters (JS — treat missing values safely)
    if (minRating) guides = guides.filter(g => (parseFloat(g.rating) || 0) >= parseFloat(minRating));
    if (minPrice)  guides = guides.filter(g => (parseFloat(g.pricePerDay) || 0) >= parseFloat(minPrice));
    if (maxPrice)  guides = guides.filter(g => (parseFloat(g.pricePerDay) || 0) <= parseFloat(maxPrice));

    // Sort
    if (sortBy === 'price_asc')       guides.sort((a, b) => (a.pricePerDay || 0) - (b.pricePerDay || 0));
    else if (sortBy === 'price_desc') guides.sort((a, b) => (b.pricePerDay || 0) - (a.pricePerDay || 0));
    else                              guides.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    // Paginate after all filtering/sorting
    const totalAfterFilter = guides.length;
    const start = (page - 1) * pageSize;
    const hasMore = start + pageSize < guides.length;
    guides = guides.slice(start, start + pageSize);

    const safe = guides.map(({ password, availability, ...g }) =>
      sanitizeContact({ ...g, availableCount: (availability || []).length }, req.user)
    );
    res.json({
      success: true,
      count: safe.length,
      total: totalAfterFilter,
      page, pageSize, hasMore,
      guides: safe,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/companies/:id — public company profile + their tour packages
exports.getCompany = async (req, res) => {
  try {
    const company = await users.findById(req.params.id);
    if (!company || company.userType !== 'company') {
      return res.status(404).json({ success: false, message: 'Company not found.' });
    }
    const { password, ...safe } = company;
    res.json({ success: true, company: sanitizeContact(safe, req.user) });
  } catch (err) {
    console.error('[getCompany]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// Companies featured carousel cache (matches the guides one).
let _topCompaniesCache = { at: 0, data: null };
const TOP_COMPANIES_CACHE_MS = 60 * 1000;

// Score companies the same way we score guides: quality (rating), social
// proof (reviews), activity (bookings), profile completeness.
function companyFeaturedScore(c) {
  const rating   = Number(c.rating) || 0;
  const reviews  = Number(c.totalReviews) || 0;
  const bookings = Number(c.totalBookings) || 0;
  let score = 0;
  score += (rating / 5) * 40;
  score += Math.min(reviews, 15) * 2;
  score += Math.min(bookings, 15) * 2;
  if (c.photo) score += 6;
  if (c.companyDescription && c.companyDescription.length > 30) score += 4;
  if (Array.isArray(c.galleryPhotos) && c.galleryPhotos.length) score += 4;
  if (Array.isArray(c.companyDestinations) && c.companyDestinations.length) score += 3;
  if (Array.isArray(c.companyServices) && c.companyServices.length) score += 2;
  return score;
}

// GET /api/companies/top — verified, non-suspended companies, ranked.
exports.topCompanies = async (req, res) => {
  try {
    if (_topCompaniesCache.data && Date.now() - _topCompaniesCache.at < TOP_COMPANIES_CACHE_MS) {
      return res.json({ success: true, cached: true, companies: _topCompaniesCache.data });
    }
    const companies = await users.findAllWhere({ userType: 'company', isVerified: true, isSuspended: false });
    companies.sort((a, b) =>
      (companyFeaturedScore(b) - companyFeaturedScore(a)) ||
      ((b.rating || 0) - (a.rating || 0)) ||
      ((b.totalReviews || 0) - (a.totalReviews || 0)) ||
      (new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    );
    const top = companies.slice(0, 10).map(({ password, ...c }) => sanitizeContact(c, req.user));
    _topCompaniesCache = { at: Date.now(), data: top };
    res.json({ success: true, cached: false, companies: top });
  } catch (err) {
    console.error('[topCompanies]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.getGuide = async (req, res) => {
  try {
    const guide = await users.findById(req.params.id);
    if (!guide || guide.userType !== 'guide') {
      return res.status(404).json({ success: false, message: 'Guide not found.' });
    }
    const { password, ...safe } = guide;
    const guideReviews = await reviews.findAllByField('guideId', guide.id);
    guideReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, guide: sanitizeContact(safe, req.user), reviews: guideReviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.updateAvailability = async (req, res) => {
  try {
    const guideId = req.session.userId;
    const { availability, availabilitySlots } = req.body;

    const patch = {};

    // New time-slot system
    if (availabilitySlots !== undefined) {
      if (!Array.isArray(availabilitySlots)) {
        return res.status(400).json({ success: false, message: 'availabilitySlots must be an array.' });
      }
      // Validate each slot has required fields
      for (const s of availabilitySlots) {
        if (!s.date || !s.startTime || !s.endTime || s.price == null) {
          return res.status(400).json({ success: false, message: 'Each slot must have date, startTime, endTime, price.' });
        }
      }
      patch.availabilitySlots = availabilitySlots;
    }

    // Legacy date-array system (keep for backward compat)
    if (availability !== undefined) {
      if (!Array.isArray(availability)) {
        return res.status(400).json({ success: false, message: 'Availability must be an array.' });
      }
      patch.availability = availability;
    }

    if (!Object.keys(patch).length) {
      return res.status(400).json({ success: false, message: 'Nothing to update.' });
    }

    await users.update(guideId, patch);
    res.json({ success: true, message: 'Availability updated.', ...patch });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.updateAssets = async (req, res) => {
  try {
    const guideId = req.session.userId;
    const { guideAssets } = req.body;
    if (!Array.isArray(guideAssets)) {
      return res.status(400).json({ success: false, message: 'guideAssets must be an array.' });
    }
    for (const a of guideAssets) {
      if (!a.id || !a.type || !a.title) {
        return res.status(400).json({ success: false, message: 'Each asset must have id, type, title.' });
      }
    }
    try {
      await users.update(guideId, { guideAssets });
    } catch (e) {
      // Surface schema problems instead of failing silently — the saved data
      // would otherwise look successful in the UI but never reach the guide
      // profile that tourists see.
      const msg = String(e?.message || '');
      if (/Could not find the '\w+' column|column \S+ does not exist|schema cache/i.test(msg)) {
        console.error('[updateAssets] schema mismatch — run migration 032:', msg);
        return res.status(500).json({
          success: false,
          message: "Couldn't save your media right now. Please try again shortly. — تعذّر حفظ الوسائط حالياً، حاول لاحقاً.",
        });
      }
      throw e;
    }
    res.json({ success: true, message: 'Assets updated.', guideAssets });
  } catch (err) {
    console.error('[updateAssets]', err.message);
    res.status(500).json({ success: false, message: "Couldn't save your changes. Please try again. — تعذّر حفظ التغييرات، حاول مجدداً." });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const guideId = req.session.userId;
    const { bio, phone, pricePerDay, languages, specialisations, destinations } = req.body;

    const changes = {};
    if (bio !== undefined)        changes.bio = bio;
    if (phone !== undefined)      changes.phone = phone;
    if (pricePerDay !== undefined) changes.pricePerDay = parseFloat(pricePerDay);
    if (languages)      changes.languages      = Array.isArray(languages)      ? languages      : languages.split(',').map(s => s.trim());
    if (specialisations) changes.specialisations = Array.isArray(specialisations) ? specialisations : specialisations.split(',').map(s => s.trim());
    if (destinations)   changes.destinations   = Array.isArray(destinations)   ? destinations   : destinations.split(',').map(s => s.trim());

    const updated = await users.update(guideId, changes);
    const { password, ...safe } = updated;
    res.json({ success: true, message: 'Profile updated.', guide: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// Composite "featured" score — prioritizes the most active and best-rated
// guides. Combines quality (rating), social proof (reviews), activity
// (bookings) and profile completeness so engaged guides surface on the
// homepage even before they accumulate reviews.
function featuredScore(g) {
  const rating   = Number(g.rating) || 0;
  const reviews  = Number(g.totalReviews) || 0;
  const bookings = Number(g.totalBookings) || 0;

  let score = 0;
  score += (rating / 5) * 40;            // quality        → up to 40
  score += Math.min(reviews, 15) * 2;    // social proof   → up to 30
  score += Math.min(bookings, 15) * 2;   // activity       → up to 30

  // Profile completeness — an "active" guide keeps a rich profile.
  if (g.photo) score += 6;
  if (g.bio && g.bio.length > 30) score += 4;
  if (Array.isArray(g.galleryPhotos) && g.galleryPhotos.length) score += 4;
  if (Array.isArray(g.languages) && g.languages.length) score += 2;
  if (Array.isArray(g.destinations) && g.destinations.length) score += 2;
  if (g.videoUrl) score += 2;
  if (Array.isArray(g.availabilitySlots) && g.availabilitySlots.length) score += 3; // currently bookable
  if (Array.isArray(g.guideAssets) && g.guideAssets.length) score += 2;

  return score;
}

// Cache the homepage top-guides list for a short window. Same result for
// every visitor for 60s, but a guide newly added/edited still surfaces fast.
let _topCache = { at: 0, data: null };
const TOP_CACHE_MS = 60 * 1000;

exports.topGuides = async (req, res) => {
  try {
    if (_topCache.data && Date.now() - _topCache.at < TOP_CACHE_MS) {
      return res.json({ success: true, cached: true, guides: _topCache.data });
    }
    const guides = await users.findAllWhere({ userType: 'guide', isVerified: true, isSuspended: false });
    guides.sort((a, b) =>
      (featuredScore(b) - featuredScore(a)) ||
      ((b.rating || 0) - (a.rating || 0)) ||
      ((b.totalReviews || 0) - (a.totalReviews || 0)) ||
      (new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    );
    const top = guides.slice(0, 10).map(({ password, ...g }) => sanitizeContact(g, req.user));
    _topCache = { at: Date.now(), data: top };
    res.json({ success: true, cached: false, guides: top });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/guides/me/analytics — personal performance dashboard for a guide.
// All figures derive from this guide's own bookings + reviews. Cached 60s
// per guide to keep the dashboard snappy and protect DB egress.
const _guideAnalyticsCache = new Map(); // guideId -> { at, data }
const GUIDE_ANALYTICS_TTL = 60 * 1000;

exports.analytics = async (req, res) => {
  try {
    const guideId = req.session.userId;

    const cached = _guideAnalyticsCache.get(guideId);
    if (cached && Date.now() - cached.at < GUIDE_ANALYTICS_TTL) {
      return res.json({ success: true, cached: true, data: cached.data });
    }

    const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
    const now = new Date();

    const [myBookings, myReviews] = await Promise.all([
      bookings.findAllByField('guideId', guideId),
      reviews.findAllByField('guideId', guideId).catch(() => []),
    ]);

    // ── Status funnel ──
    const byStatus = { pending: 0, quoted: 0, confirmed: 0, in_progress: 0, completed: 0, cancelled: 0 };
    for (const b of myBookings) {
      const s = b.status || 'pending';
      byStatus[s] = (byStatus[s] || 0) + 1;
    }
    const total      = myBookings.length;
    const paid       = myBookings.filter(b => b.isPaid);
    const completed  = myBookings.filter(b => b.status === 'completed');
    const cancelled  = byStatus.cancelled || 0;

    // ── Earnings (paid bookings) ──
    const grossEarnings = r3(paid.reduce((s, b) => s + (parseFloat(b.totalAmount) || 0), 0));
    const COMMISSION = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.10');
    const netEarnings = r3(grossEarnings * (1 - COMMISSION));
    const aov = paid.length ? r3(grossEarnings / paid.length) : 0;

    // ── Conversion: confirmed-or-better / total requests ──
    const accepted = myBookings.filter(b => ['confirmed', 'in_progress', 'completed'].includes(b.status)).length;
    const conversion = total ? r3((accepted / total) * 100) : 0;

    // ── Bookings + earnings over last 6 months ──
    const monthMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      monthMap[k] = { month: k, bookings: 0, earnings: 0 };
    }
    for (const b of myBookings) {
      const d = new Date(b.paidAt || b.createdAt || now);
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (monthMap[k]) {
        monthMap[k].bookings += 1;
        if (b.isPaid) monthMap[k].earnings += (parseFloat(b.totalAmount) || 0);
      }
    }
    const monthly = Object.values(monthMap).map(m => ({ ...m, earnings: r3(m.earnings) }));

    // ── Top destinations (this guide) ──
    const destMap = {};
    for (const b of myBookings) {
      if (!b.destination) continue;
      destMap[b.destination] = (destMap[b.destination] || 0) + 1;
    }
    const topDestinations = Object.entries(destMap)
      .map(([destination, count]) => ({ destination, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // ── Ratings ──
    const ratingCount = myReviews.length;
    const avgRating = ratingCount
      ? r3(myReviews.reduce((s, rv) => s + (rv.rating || 0), 0) / ratingCount)
      : 0;
    const ratingDist = [1, 2, 3, 4, 5].map(star => ({
      star,
      count: myReviews.filter(rv => Math.round(rv.rating || 0) === star).length,
    }));

    const data = {
      currency: 'OMR',
      overview: {
        total, completed: completed.length, cancelled,
        grossEarnings, netEarnings, aov,
        conversion, avgRating, ratingCount,
        upcoming: byStatus.confirmed + byStatus.in_progress,
        pending: byStatus.pending + byStatus.quoted,
      },
      byStatus,
      monthly,
      topDestinations,
      ratingDist,
      generatedAt: now.toISOString(),
    };

    _guideAnalyticsCache.set(guideId, { at: Date.now(), data });
    res.json({ success: true, cached: false, data });
  } catch (err) {
    console.error('[guide:analytics]', err.message);
    res.status(500).json({ success: false, message: "Couldn't load analytics right now. — تعذّر تحميل التحليلات حالياً." });
  }
};
