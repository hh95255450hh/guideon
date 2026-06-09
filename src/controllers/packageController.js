const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const emailService = require('../services/emailService');
const { sanitizeContact } = require('../utils/sanitizeContact');

const packages = new SupabaseDB('tour_packages');
const users    = new SupabaseDB('users');

// GET /api/packages — public list with filters
exports.list = async (req, res) => {
  try {
    const { destination, category, difficulty, minPrice, maxPrice, minDays, maxDays, sortBy, providerId } = req.query;

    // Push provider filter to the DB (was: load ALL packages then filter in JS,
    // which got slow as the catalog grew — felt like the site was hanging
    // when opening guide profiles).
    let pkgs;
    if (providerId) {
      pkgs = await packages.findAllWhere({ isPublished: true, providerId });
    } else {
      pkgs = await packages.findAllByField('isPublished', true);
    }
    if (destination)  pkgs = pkgs.filter(p => (p.destination || '').toLowerCase().includes(destination.toLowerCase()));
    if (category) {
      // Match either the legacy single category field OR any item in the new categories array
      const cat = category.toLowerCase();
      pkgs = pkgs.filter(p => {
        if (p.category && p.category.toLowerCase() === cat) return true;
        if (Array.isArray(p.categories) && p.categories.some(c => (c || '').toLowerCase() === cat)) return true;
        return false;
      });
    }
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

// GET /api/packages/popular — most-booked published tours (homepage carousel)
exports.popular = async (req, res) => {
  try {
    let pkgs = await packages.findAllByField('isPublished', true);
    pkgs.sort((a, b) =>
      ((b.totalBookings || 0) - (a.totalBookings || 0)) ||
      ((b.rating || 0) - (a.rating || 0)) ||
      (new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    );
    const top = pkgs.slice(0, 10);
    const enriched = await Promise.all(top.map(async p => {
      const prov = await users.findById(p.providerId).catch(() => null);
      return { ...p, providerName: prov ? prov.fullName : '' };
    }));
    res.json({ success: true, packages: enriched });
  } catch (err) {
    console.error('[packages:popular]', err.message);
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
      // Strip phone/email/social so tourists can't bypass the platform.
      pkg.provider = sanitizeContact(safe, req.user);
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
      title, description, destination, region, category, categories, difficulty,
      duration_days, duration_hours, duration_minutes,
      max_group_size, price_adult, price_child, currency,
      includes, excludes, itinerary, meeting_point, languages, images,
      cover_image, cancellation_policy,
      isPublished, discountPercent, offerLabel, offerUntil,
      variants, addons, availableDates, highlights,
      meetingPoint, route,   // interactive map fields (lat/lng + route array)
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
      category: category || (Array.isArray(categories) && categories[0]) || 'Cultural',
      categories: Array.isArray(categories) && categories.length
        ? categories
        : (category ? [category] : []),
      difficulty: difficulty || 'moderate',
      duration_days:    Math.max(0, parseInt(duration_days) || 0),
      duration_hours:   Math.min(23, Math.max(0, parseInt(duration_hours) || 0)),
      duration_minutes: Math.min(59, Math.max(0, parseInt(duration_minutes) || 0)),
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
      // Interactive map — coerce defensively. Only accept finite numbers
      // so a malformed payload can never crash the page.
      meetingPoint: (meetingPoint && Number.isFinite(meetingPoint.lat) && Number.isFinite(meetingPoint.lng))
        ? { lat: +meetingPoint.lat, lng: +meetingPoint.lng } : null,
      route: Array.isArray(route)
        ? route.filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
               .map(p => ({ lat: +p.lat, lng: +p.lng }))
        : [],
      rating: 0, totalReviews: 0, totalBookings: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Resilient insert: strip any column that doesn't yet exist in the DB and
    // retry, the same way authController handles outstanding user-table
    // migrations. Companies were unable to add a package because the schema
    // was behind several migrations; this unblocks them while we run the
    // catch-up migration.
    let inserted;
    const droppedCols = [];
    let attempts = 0;
    while (true) {
      try {
        inserted = await packages.insert(pkg);
        break;
      } catch (insErr) {
        attempts++;
        const m = String(insErr?.message || '').match(/Could not find the '([^']+)' column|column "([^"]+)" of relation/);
        const col = m && (m[1] || m[2]);
        if (col && pkg[col] !== undefined && attempts < 20) {
          console.warn('[packages.create] Stripping missing column "' + col + '" and retrying');
          droppedCols.push(col);
          delete pkg[col];
          continue;
        }
        throw insErr;
      }
    }
    if (droppedCols.length) {
      console.warn('[packages.create] Saved after dropping columns:', droppedCols.join(', '));
    }

    // Alert the owner/staff of a new tour (a key "addition" to manage).
    try {
      const prov = await users.findById(pkg.providerId);
      const who  = prov ? (prov.fullName || prov.companyName || prov.email) : pkg.providerId;
      emailService.notifyAdmins(`[Guideon] 🗺️ New tour: ${pkg.title}`, emailService.notificationEmail({
        icon: '🗺️',
        title:   `New tour added: "${pkg.title}" by ${who}`,
        titleAr: `رحلة جديدة: "${pkg.title}" بواسطة ${who}`,
        body:    `Region: ${pkg.destination || '-'} · Price: ${pkg.price_adult || '-'} OMR`,
        bodyAr:  `المنطقة: ${pkg.destination || '-'} · السعر: ${pkg.price_adult || '-'} ريال`,
        link: '/admin.html',
      }));
    } catch (_) {}

    res.status(201).json({ success: true, message: 'Package created. Publish it when ready.', package: inserted });
  } catch (err) {
    console.error('[packageController.create] FAILED:', err?.message || err, err?.code || '');
    const msg = String(err?.message || '');

    // Map specific Postgres errors to actionable messages.
    if (/duration_days_check/i.test(msg)) {
      return res.status(400).json({ success: false, message: 'Please set the duration (at least one of days / hours / minutes must be > 0). If the form looks correct, ask admin to run migration 015.' });
    }
    if (/duration_nonzero/i.test(msg)) {
      return res.status(400).json({ success: false, message: 'Please set the duration — a tour must have at least 1 minute, hour, or day.' });
    }
    if (/duration_hours_range/i.test(msg)) {
      return res.status(400).json({ success: false, message: 'Hours must be between 0 and 23.' });
    }
    if (/duration_minutes_range/i.test(msg)) {
      return res.status(400).json({ success: false, message: 'Minutes must be between 0 and 59.' });
    }
    if (/column .* of relation .* does not exist|Could not find the .* column/i.test(msg)) {
      const colMatch = msg.match(/column "([^"]+)"|the '([^']+)' column/);
      const col = colMatch ? (colMatch[1] || colMatch[2]) : 'unknown';
      return res.status(500).json({ success: false, message: `Database schema is missing the "${col}" column. Admin: run the latest migration.` });
    }
    res.status(500).json({ success: false, message: 'Could not save the tour. Please try again — if it keeps failing, contact support via WhatsApp.' });
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

    const allowed = ['title', 'description', 'destination', 'region', 'category', 'categories', 'difficulty',
      'duration_days', 'duration_hours', 'duration_minutes',
      'max_group_size', 'price_adult', 'price_child', 'currency',
      'includes', 'excludes', 'itinerary', 'meeting_point', 'languages', 'images',
      'cover_image', 'cancellation_policy', 'isPublished',
      'discountPercent', 'offerLabel', 'offerUntil',
      'variants', 'addons', 'availableDates', 'highlights',
      'meetingPoint', 'route'];   // interactive map
    const changes = { updatedAt: new Date().toISOString() };
    for (const k of allowed) {
      if (req.body[k] !== undefined) changes[k] = req.body[k];
    }

    // Resilient update: same missing-column retry pattern as create, so
    // new fields (e.g. meetingPoint / route from migration 036) don't
    // break edits before the migration runs in production.
    let updated;
    const droppedCols = [];
    while (true) {
      try { updated = await packages.update(req.params.id, changes); break; }
      catch (e) {
        const m = String(e?.message || '').match(/Could not find the '([^']+)' column|column "([^"]+)" of relation/);
        const col = m && (m[1] || m[2]);
        if (col && changes[col] !== undefined) {
          droppedCols.push(col);
          delete changes[col];
          continue;
        }
        throw e;
      }
    }
    // Surface dropped-column problems to ops so map / new-field data
    // isn't silently lost behind a pending migration.
    if (droppedCols.length) {
      console.warn('[packages.update] Saved after dropping columns:', droppedCols.join(', '), '— run the pending migration.');
    }
    res.json({ success: true, package: updated, _droppedCols: droppedCols.length ? droppedCols : undefined });
  } catch (err) {
    console.error('[packageController.update] FAILED:', err?.message || err);
    const msg = String(err?.message || '');
    if (/duration_days_check|duration_nonzero/i.test(msg)) {
      return res.status(400).json({ success: false, message: 'Please set the duration (at least one of days / hours / minutes must be > 0).' });
    }
    if (/duration_hours_range/i.test(msg)) {
      return res.status(400).json({ success: false, message: 'Hours must be between 0 and 23.' });
    }
    if (/duration_minutes_range/i.test(msg)) {
      return res.status(400).json({ success: false, message: 'Minutes must be between 0 and 59.' });
    }
    res.status(500).json({ success: false, message: 'Could not save the tour. Please try again.' });
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
