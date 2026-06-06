const SupabaseDB = require('../models/SupabaseDB');

const users    = new SupabaseDB('users');
const reviews  = new SupabaseDB('reviews', 'reviewId');
const packages = new SupabaseDB('tour_packages');

exports.searchGuides = async (req, res) => {
  try {
    const { destination, governorate, language, date, specialisation, minRating, sortBy, minPrice, maxPrice } = req.query;

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
    if (minRating) guides = guides.filter(g => g.rating >= parseFloat(minRating));
    if (minPrice)  guides = guides.filter(g => g.pricePerDay >= parseFloat(minPrice));
    if (maxPrice)  guides = guides.filter(g => g.pricePerDay <= parseFloat(maxPrice));

    if (sortBy === 'price_asc')  guides.sort((a, b) => a.pricePerDay - b.pricePerDay);
    else if (sortBy === 'price_desc') guides.sort((a, b) => b.pricePerDay - a.pricePerDay);
    else guides.sort((a, b) => b.rating - a.rating);

    const safe = guides.map(({ password, availability, ...g }) => ({
      ...g, availableCount: (availability || []).length,
    }));
    res.json({ success: true, count: safe.length, guides: safe });
  } catch (err) {
    console.error(err);
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
    res.json({ success: true, guide: safe, reviews: guideReviews });
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
    await users.update(guideId, { guideAssets });
    res.json({ success: true, message: 'Assets updated.', guideAssets });
  } catch (err) {
    console.error('[updateAssets]', err);
    res.status(500).json({ success: false, message: 'Server error.' });
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
    const top = guides.slice(0, 10).map(({ password, ...g }) => g);
    _topCache = { at: Date.now(), data: top };
    res.json({ success: true, cached: false, guides: top });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
