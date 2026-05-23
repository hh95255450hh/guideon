const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');

const packages = new SupabaseDB('tour_packages');
const users    = new SupabaseDB('users');

// GET /api/packages — public list with filters
exports.list = async (req, res) => {
  try {
    const { destination, category, difficulty, minPrice, maxPrice, minDays, maxDays, sortBy, providerId } = req.query;

    let pkgs = await packages.findAllByField('isPublished', true);

    if (providerId)   pkgs = pkgs.filter(p => p.providerId === providerId);
    if (destination)  pkgs = pkgs.filter(p => (p.destination || '').toLowerCase().includes(destination.toLowerCase()));
    if (category)     pkgs = pkgs.filter(p => p.category === category);
    if (difficulty)   pkgs = pkgs.filter(p => p.difficulty === difficulty);
    if (minPrice)     pkgs = pkgs.filter(p => p.price_adult >= parseFloat(minPrice));
    if (maxPrice)     pkgs = pkgs.filter(p => p.price_adult <= parseFloat(maxPrice));
    if (minDays)      pkgs = pkgs.filter(p => p.duration_days >= parseInt(minDays));
    if (maxDays)      pkgs = pkgs.filter(p => p.duration_days <= parseInt(maxDays));

    if (sortBy === 'price_asc')       pkgs.sort((a, b) => a.price_adult - b.price_adult);
    else if (sortBy === 'price_desc') pkgs.sort((a, b) => b.price_adult - a.price_adult);
    else if (sortBy === 'rating')     pkgs.sort((a, b) => b.rating - a.rating);
    else                              pkgs.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0) || b.rating - a.rating);

    res.json({ success: true, count: pkgs.length, packages: pkgs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/packages/:id — single package details
exports.get = async (req, res) => {
  try {
    const pkg = await packages.findById(req.params.id);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });

    const provider = await users.findById(pkg.providerId);
    if (provider) {
      const { password, ...safe } = provider;
      pkg.provider = safe;
    }

    res.json({ success: true, package: pkg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/packages — create (guide or company)
exports.create = async (req, res) => {
  try {
    const providerId = req.session.userId;
    const userType   = req.session.userType;
    if (!['guide', 'company'].includes(userType)) {
      return res.status(403).json({ success: false, message: 'Only guides and companies can create packages.' });
    }

    const {
      title, description, destination, region, category, difficulty,
      duration_days, max_group_size, price_adult, price_child, currency,
      includes, excludes, itinerary, meeting_point, languages, images,
      cover_image, cancellation_policy,
      isPublished, discountPercent, offerLabel, offerUntil,
      variants, addons, availableDates, highlights,
    } = req.body;

    if (!title || !description || !price_adult) {
      return res.status(400).json({ success: false, message: 'Title, description and price are required.' });
    }

    const pkg = {
      id: 'pkg-' + uuidv4().slice(0, 12),
      providerId, providerType: userType,
      guideId: userType === 'guide' ? providerId : null,
      title, description,
      destination: destination || '',
      region: region || '',
      category: category || 'cultural',
      difficulty: difficulty || 'moderate',
      duration_days: parseInt(duration_days) || 1,
      max_group_size: parseInt(max_group_size) || 10,
      price_adult: parseFloat(price_adult),
      price_child: parseFloat(price_child) || 0,
      currency: currency || 'OMR',
      includes: includes || [],
      excludes: excludes || [],
      itinerary: itinerary || [],
      meeting_point: meeting_point || '',
      languages: languages || [],
      images: images || [],
      cover_image: cover_image || '',
      cancellation_policy: cancellation_policy || 'flexible',
      isPublished: isPublished !== undefined ? !!isPublished : false,
      isFeatured: false,
      discountPercent: Math.max(0, Math.min(90, parseInt(discountPercent) || 0)),
      offerLabel: offerLabel || null,
      offerUntil: offerUntil || null,
      variants:       Array.isArray(variants)       ? variants       : [],
      addons:         Array.isArray(addons)         ? addons         : [],
      availableDates: Array.isArray(availableDates) ? availableDates : [],
      highlights:     Array.isArray(highlights)     ? highlights     : [],
      rating: 0, totalReviews: 0, totalBookings: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const inserted = await packages.insert(pkg);
    res.status(201).json({ success: true, message: 'Package created. Publish it when ready.', package: inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PUT /api/packages/:id — update own package
exports.update = async (req, res) => {
  try {
    const pkg = await packages.findById(req.params.id);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });
    if (pkg.providerId !== req.session.userId && req.session.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const allowed = ['title', 'description', 'destination', 'region', 'category', 'difficulty',
      'duration_days', 'max_group_size', 'price_adult', 'price_child', 'currency',
      'includes', 'excludes', 'itinerary', 'meeting_point', 'languages', 'images',
      'cover_image', 'cancellation_policy', 'isPublished',
      'discountPercent', 'offerLabel', 'offerUntil',
      'variants', 'addons', 'availableDates', 'highlights'];
    const changes = { updatedAt: new Date().toISOString() };
    for (const k of allowed) {
      if (req.body[k] !== undefined) changes[k] = req.body[k];
    }

    const updated = await packages.update(req.params.id, changes);
    res.json({ success: true, package: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/packages/:id — delete own package
exports.remove = async (req, res) => {
  try {
    const pkg = await packages.findById(req.params.id);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });
    if (pkg.providerId !== req.session.userId && req.session.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    await packages.delete(req.params.id);
    res.json({ success: true, message: 'Package deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/packages/mine — provider's own packages
exports.mine = async (req, res) => {
  try {
    const list = await packages.findAllByField('providerId', req.session.userId);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, packages: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/packages/:id/feature — admin only
exports.toggleFeature = async (req, res) => {
  try {
    const pkg = await packages.findById(req.params.id);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });
    const updated = await packages.update(req.params.id, { isFeatured: !pkg.isFeatured });
    res.json({ success: true, package: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
