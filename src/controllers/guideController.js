const SupabaseDB = require('../models/SupabaseDB');

const users   = new SupabaseDB('users');
const reviews = new SupabaseDB('reviews', 'reviewId');

exports.searchGuides = async (req, res) => {
  try {
    const { destination, language, date, specialisation, minRating, sortBy, minPrice, maxPrice } = req.query;

    let guides = await users.findAll(u => u.userType === 'guide' && u.isVerified && !u.isSuspended);

    if (destination) {
      guides = guides.filter(g => (g.destinations || []).some(d => d.toLowerCase().includes(destination.toLowerCase())));
    }
    if (language) {
      guides = guides.filter(g => (g.languages || []).some(l => l.toLowerCase().includes(language.toLowerCase())));
    }
    if (date) {
      guides = guides.filter(g => (g.availability || []).includes(date));
    }
    if (specialisation) {
      guides = guides.filter(g => (g.specialisations || []).some(s => s.toLowerCase().includes(specialisation.toLowerCase())));
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
    const guideReviews = await reviews.findAll(r => r.guideId === guide.id);
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
    const { availability } = req.body;
    if (!Array.isArray(availability)) {
      return res.status(400).json({ success: false, message: 'Availability must be an array of dates.' });
    }
    await users.update(guideId, { availability });
    res.json({ success: true, message: 'Availability updated.', availability });
  } catch (err) {
    console.error(err);
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

exports.topGuides = async (req, res) => {
  try {
    const guides = await users.findAll(u => u.userType === 'guide' && u.isVerified && !u.isSuspended);
    guides.sort((a, b) => b.rating - a.rating);
    const top = guides.slice(0, 3).map(({ password, ...g }) => g);
    res.json({ success: true, guides: top });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
