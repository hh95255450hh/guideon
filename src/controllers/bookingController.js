const SupabaseDB = require('../models/SupabaseDB');
const email = require('../services/emailService');
const { notify } = require('../services/notificationService');
const bookingService = require('../services/bookingService');
const { removeSlotFromAvailability, isValidDateStr, hoursUntilDate, omanDateStart } = require('../domain/bookingRules');

const bookings = new SupabaseDB('bookings');
const users    = new SupabaseDB('users');
const reviews  = new SupabaseDB('reviews');

// Columns added by migration 021 that may not exist yet on older deployments.
// We strip them and retry so the booking flow keeps working before the migration runs.
const OPTIONAL_BOOKING_COLS = ['startedAt', 'completedAt', 'variantName', 'addons'];
const isMissingColumnError = (msg) => /Could not find the '\w+' column|schema cache/i.test(msg || '');

async function updateBookingSafe(id, data) {
  try {
    return await bookings.update(id, data);
  } catch (e) {
    if (isMissingColumnError(e.message)) {
      const clean = { ...data };
      OPTIONAL_BOOKING_COLS.forEach(c => delete clean[c]);
      return await bookings.update(id, clean);
    }
    throw e;
  }
}

// Thin controller: delegate booking creation to the service, map errors to HTTP.
exports.createBooking = async (req, res) => {
  try {
    const booking = await bookingService.createBooking(req.session.userId, req.body);
    res.status(201).json({
      success: true,
      message: 'Booking request sent. Waiting for guide confirmation.',
      booking,
    });
  } catch (err) {
    if (err instanceof bookingService.BookingError) {
      return res.status(err.status).json({ success: false, code: err.code, message: err.message });
    }
    console.error('[createBooking]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


exports.myBookings = async (req, res) => {
  try {
    const touristId = req.session.userId;
    const list = await bookings.findAllByField('touristId', touristId);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Batch-fetch guides and reviews in 2 queries instead of N+N
    const guideIds    = [...new Set(list.map(b => b.guideId))];
    const bookingIds  = list.map(b => b.id);
    const [guideList, reviewList] = await Promise.all([
      users.findByIds(guideIds),
      reviews.findAllWhereIn('bookingId', bookingIds),
    ]);
    const guideMap  = Object.fromEntries(guideList.map(g => [g.id, g]));
    const reviewSet = new Set(reviewList.map(r => r.bookingId));

    const enriched = list.map(b => {
      const guide = guideMap[b.guideId];
      return { ...b, guideName: guide ? guide.fullName : 'Unknown', guideRating: guide ? guide.rating : 0, reviewed: reviewSet.has(b.id) };
    });
    res.json({ success: true, bookings: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.guideBookings = async (req, res) => {
  try {
    const guideId = req.session.userId;
    const list = await bookings.findAllByField('guideId', guideId);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Batch-fetch tourists in 1 query instead of N
    const touristIds  = [...new Set(list.map(b => b.touristId))];
    const touristList = await users.findByIds(touristIds);
    const touristMap  = Object.fromEntries(touristList.map(t => [t.id, t]));

    const enriched = list.map(b => {
      const tourist = touristMap[b.touristId];
      return { ...b, touristName: tourist ? tourist.fullName : 'Unknown', touristEmail: tourist ? tourist.email : '' };
    });
    res.json({ success: true, bookings: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const booking = await bookings.findById(id);

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    const userId   = req.session.userId;
    const userType = req.session.userType;

    // Only known roles may touch booking status. Any unrecognised userType
    // (e.g. 'team', 'staff' without explicit admin grant) is refused here
    // before it even reaches the allowedTransitions table — belt-and-suspenders.
    const KNOWN_ROLES = ['guide', 'company', 'tourist', 'admin', 'staff'];
    if (!KNOWN_ROLES.includes(userType)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // A company is a provider too: the booking's guideId holds the
    // provider's user id whether they're a solo guide or a company.
    const isProvider = userType === 'guide' || userType === 'company';
    if (isProvider              && booking.guideId   !== userId) return res.status(403).json({ success: false, message: 'Access denied.' });
    if (userType === 'tourist'  && booking.touristId !== userId) return res.status(403).json({ success: false, message: 'Access denied.' });
    // Staff are not admins — they cannot mutate bookings they don't own.
    if (userType === 'staff') return res.status(403).json({ success: false, message: 'Access denied. Use the admin panel.' });

    if (userType === 'tourist' && status === 'cancelled') {
      // Oman-local, NaN-safe: a malformed stored date must not silently bypass
      // the 48h rule (NaN < 48 is false). Only enforce when the date is valid.
      if (isValidDateStr(booking.tourDate)) {
        const hoursUntil = hoursUntilDate(booking.tourDate);
        if (hoursUntil < 48) {
          return res.status(400).json({ success: false, message: 'Cancellations must be made at least 48 hours before the tour.' });
        }
      }
    }

    const allowedTransitions = {
      guide:   ['confirmed', 'cancelled', 'in_progress', 'completed'],
      company: ['confirmed', 'cancelled', 'in_progress', 'completed'],
      tourist: ['cancelled', 'confirmed'], // tourist 'confirmed' = accept the guide's price offer
      admin:   ['confirmed', 'cancelled', 'in_progress', 'completed'],
    };

    if (!allowedTransitions[userType]?.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status transition.' });
    }

    // Tourist can only CONFIRM (accept) a booking that the guide has quoted.
    // On acceptance the agreed price becomes the booking total.
    if (status === 'confirmed' && userType === 'tourist') {
      if (booking.status !== 'quoted') {
        return res.status(400).json({ success: false, message: 'You can only accept a price offer from the guide.' });
      }
    }

    // Provider (guide/company) can only START trip from 'confirmed' status, on/after tour date
    if (status === 'in_progress' && isProvider) {
      if (booking.status !== 'confirmed') {
        return res.status(400).json({ success: false, message: 'Trip can only be started from a confirmed booking.' });
      }
      // Allow starting up to 1 day before the scheduled date (Oman-local),
      // for evening/overnight tours etc.
      if (isValidDateStr(booking.tourDate)) {
        const earliestStart = omanDateStart(booking.tourDate).getTime() - 24 * 3600 * 1000;
        if (Date.now() < earliestStart) {
          return res.status(400).json({ success: false, message: 'Cannot start trip more than 1 day before the scheduled date.' });
        }
      }
    }

    // Provider (guide/company) can only COMPLETE trip from 'in_progress' status
    if (status === 'completed' && isProvider) {
      if (booking.status !== 'in_progress') {
        return res.status(400).json({ success: false, message: 'Only trips that have started can be completed.' });
      }
    }

    const updateData = { status };
    if (status === 'in_progress') updateData.startedAt = new Date().toISOString();
    if (status === 'completed')   updateData.completedAt = new Date().toISOString();
    // Tourist accepted the offer → the quoted price becomes the booking total.
    if (status === 'confirmed' && userType === 'tourist' && booking.quotedAmount != null) {
      updateData.totalAmount = booking.quotedAmount;
    }

    const updated = await updateBookingSafe(id, updateData);

    // Send emails based on new status
    const tourist = await users.findById(booking.touristId);
    const guide   = await users.findById(booking.guideId);
    // Provider notifications must link to the right dashboard.
    const providerLink = guide?.userType === 'company'
      ? '/company-dashboard.html#bookings'
      : '/guide-dashboard.html#bookings';
    const emailData = {
      destination: booking.destination,
      tourDate:    booking.tourDate,
      totalAmount: booking.totalAmount,
      bookingId:   id,
    };
    if (status === 'confirmed') {
      if (tourist) email.sendTouristBookingConfirmed({ email: tourist.email, name: tourist.fullName, guideName: guide?.fullName, ...emailData }).catch(() => {});
      if (guide)   email.sendGuideBookingConfirmed({ email: guide.email, name: guide.fullName, touristName: tourist?.fullName, ...emailData }).catch(() => {});

      // In-app notifications (bilingual EN + AR)
      if (tourist) notify({
        userId: tourist.id, type: 'booking_accepted',
        title:   'Booking confirmed!',
        titleAr: 'تم تأكيد الحجز!',
        body:   `${guide?.fullName || 'Your guide'} accepted your ${booking.destination} tour for ${booking.tourDate}.`,
        bodyAr: `قبل ${guide?.fullName || 'مرشدك'} حجزك لرحلة ${booking.destination} بتاريخ ${booking.tourDate}.`,
        link: '/tourist-dashboard.html#bookings',
        metadata: { bookingId: id },
      });
      if (guide) notify({
        userId: guide.id, type: 'booking_accepted',
        title:   'You confirmed a booking',
        titleAr: 'لقد أكّدت الحجز',
        body:   `Tour with ${tourist?.fullName || 'a tourist'} on ${booking.tourDate} is confirmed.`,
        bodyAr: `تم تأكيد الرحلة مع ${tourist?.fullName || 'السائح'} بتاريخ ${booking.tourDate}.`,
        link: providerLink,
        metadata: { bookingId: id },
      });

      // Remove booked slot from guide availability
      if (guide) {
        const patch = {};
        // New slot system
        if (booking.startTime && Array.isArray(guide.availabilitySlots)) {
          patch.availabilitySlots = guide.availabilitySlots.filter(s =>
            !(s.date === booking.tourDate && s.startTime === booking.startTime)
          );
        }
        // Legacy system
        const avail = Array.isArray(guide.availability) ? guide.availability : [];
        const newAvail = removeSlotFromAvailability(avail, booking.tourDate, booking.tourTime || 'full_day');
        if (newAvail.length !== avail.length) patch.availability = newAvail;
        if (Object.keys(patch).length) await users.update(booking.guideId, patch);
      }
    } else if (status === 'cancelled') {
      if (tourist) email.sendTouristBookingCancelled({ email: tourist.email, name: tourist.fullName, guideName: guide?.fullName, ...emailData }).catch(() => {});
      if (guide)   email.sendGuideBookingCancelled({ email: guide.email, name: guide.fullName, touristName: tourist?.fullName, ...emailData }).catch(() => {});

      const cancelledBy = (userType === 'guide' || userType === 'company') ? 'provider' : (userType === 'tourist' ? 'tourist' : 'admin');
      const cancelledByAr = (userType === 'guide' || userType === 'company') ? 'المزوّد' : (userType === 'tourist' ? 'السائح' : 'الإدارة');
      if (tourist) notify({
        userId: tourist.id, type: 'booking_cancelled',
        title:   'Booking cancelled',
        titleAr: 'تم إلغاء الحجز',
        body:   `Your ${booking.destination} tour for ${booking.tourDate} was cancelled by the ${cancelledBy}.`,
        bodyAr: `تم إلغاء رحلتك إلى ${booking.destination} بتاريخ ${booking.tourDate} من قبل ${cancelledByAr}.`,
        link: '/tourist-dashboard.html#bookings',
        metadata: { bookingId: id },
      });
      if (guide) notify({
        userId: guide.id, type: 'booking_cancelled',
        title:   'Booking cancelled',
        titleAr: 'تم إلغاء الحجز',
        body:   `Tour with ${tourist?.fullName || 'a tourist'} on ${booking.tourDate} was cancelled.`,
        bodyAr: `تم إلغاء الرحلة مع ${tourist?.fullName || 'السائح'} بتاريخ ${booking.tourDate}.`,
        link: providerLink,
        metadata: { bookingId: id },
      });

      // Restore the slot to guide availability
      if (guide) {
        const avail = Array.isArray(guide.availability) ? guide.availability : [];
        const slot = booking.tourTime || 'full_day';
        const key = `${booking.tourDate}_${slot}`;
        if (!avail.includes(key) && !avail.includes(booking.tourDate)) {
          await users.update(booking.guideId, { availability: [...avail, key] });
        }
      }
    } else if (status === 'in_progress') {
      if (tourist) email.sendTouristTripStarted({
        email: tourist.email, name: tourist.fullName,
        guideName: guide?.fullName, guidePhone: guide?.phone,
        destination: booking.destination, bookingId: id,
      }).catch(() => {});
      if (tourist) notify({
        userId: tourist.id, type: 'trip_start',
        title:   'Your tour just started 🚐',
        titleAr: 'بدأت رحلتك الآن 🚐',
        body:   `${guide?.fullName || 'Your guide'} marked the ${booking.destination} tour as in progress. Have fun!`,
        bodyAr: `أعلن ${guide?.fullName || 'مرشدك'} بدء رحلة ${booking.destination}. استمتع برحلتك!`,
        link: '/tourist-dashboard.html#bookings',
        metadata: { bookingId: id },
      });
    } else if (status === 'completed') {
      // Auto-issue the provider's payout invoice (net = gross − commission).
      require('../services/payoutInvoice').createForCompletedBooking(id).catch(() => {});
      if (tourist) email.sendTouristReviewReminder({ email: tourist.email, name: tourist.fullName, guideName: guide?.fullName, destination: booking.destination, bookingId: id }).catch(() => {});
      if (tourist) notify({
        userId: tourist.id, type: 'booking_completed',
        title:   'Tour completed — leave a review ⭐',
        titleAr: 'اكتملت الرحلة — اترك تقييماً ⭐',
        body:   `How was your ${booking.destination} tour with ${guide?.fullName || 'your guide'}? Help future travelers.`,
        bodyAr: `كيف كانت رحلتك إلى ${booking.destination} مع ${guide?.fullName || 'مرشدك'}؟ ساعد المسافرين القادمين.`,
        link: '/tourist-dashboard.html#bookings',
        metadata: { bookingId: id },
      });
      if (guide) notify({
        userId: guide.id, type: 'booking_completed',
        title:   'Tour completed 🎉',
        titleAr: 'اكتملت الرحلة 🎉',
        body:   `Tour with ${tourist?.fullName || 'a tourist'} on ${booking.tourDate} has been completed.`,
        bodyAr: `اكتملت الرحلة مع ${tourist?.fullName || 'السائح'} بتاريخ ${booking.tourDate}.`,
        link: providerLink,
        metadata: { bookingId: id },
      });
    }

    res.json({ success: true, message: 'Booking updated.', booking: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// Guide proposes a price for a pending custom-trip request.
// Moves the booking to 'quoted'; the tourist then accepts (confirm) or declines.
exports.setQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const amount = parseFloat(req.body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid price.' });
    }

    const booking = await bookings.findById(id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (booking.guideId !== req.session.userId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (!['pending', 'quoted'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'You can only price a pending request.' });
    }

    const rounded = Math.round(amount * 100) / 100;
    const updated = await updateBookingSafe(id, { status: 'quoted', quotedAmount: rounded });

    const tourist = await users.findById(booking.touristId);
    const guide   = await users.findById(booking.guideId);
    if (tourist) {
      email.sendTouristBookingPending && email.sendTouristBookingPending({
        email: tourist.email, name: tourist.fullName,
        guideName: guide?.fullName, destination: booking.destination,
        tourDate: booking.tourDate, totalAmount: rounded, bookingId: id,
      }).catch(() => {});
      notify({
        userId: tourist.id, type: 'booking_quoted',
        title:   'Price offer received 💬',
        titleAr: 'وصلك عرض سعر 💬',
        body:   `${guide?.fullName || 'Your guide'} offered OMR ${rounded} for your ${booking.destination} trip on ${booking.tourDate}. Accept to confirm.`,
        bodyAr: `عرض ${guide?.fullName || 'المرشد'} مبلغ ${rounded} ر.ع لرحلتك إلى ${booking.destination} بتاريخ ${booking.tourDate}. اقبل العرض للتأكيد.`,
        link: '/tourist-dashboard.html#bookings', metadata: { bookingId: id },
      });
    }

    res.json({ success: true, message: 'Price offer sent to the tourist.', booking: updated });
  } catch (err) {
    console.error('[setQuote]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.allBookings = async (req, res) => {
  try {
    const list = await bookings.readAll();
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Batch-fetch all guides + tourists in 2 queries instead of 2N
    const userIds  = [...new Set([...list.map(b => b.guideId), ...list.map(b => b.touristId)])];
    const userList = await users.findByIds(userIds);
    const userMap  = Object.fromEntries(userList.map(u => [u.id, u]));

    const enriched = list.map(b => ({
      ...b,
      guideName:    userMap[b.guideId]   ? userMap[b.guideId].fullName   : 'Unknown',
      touristName:  userMap[b.touristId] ? userMap[b.touristId].fullName  : 'Unknown',
      touristEmail: userMap[b.touristId] ? userMap[b.touristId].email     : '',
    }));
    res.json({ success: true, bookings: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
