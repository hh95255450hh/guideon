const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const email = require('../services/emailService');
const { notify } = require('../services/notificationService');

const bookings = new SupabaseDB('bookings');
const users    = new SupabaseDB('users');
const packages = new SupabaseDB('tour_packages');

exports.createBooking = async (req, res) => {
  try {
    const {
      guideId, tourDate, duration, destination, participants, specialRequests,
      packageId, adultCount, childCount, variantName, variantPrice, addons, totalAmount: clientTotal,
    } = req.body;
    const touristId = req.session.userId;

    if (!guideId || !tourDate || !destination) {
      return res.status(400).json({ success: false, message: 'Missing required booking fields.' });
    }

    const guide = await users.findById(guideId);
    if (!guide || guide.userType !== 'guide') {
      return res.status(404).json({ success: false, message: 'Guide not found.' });
    }
    if (!guide.isVerified) {
      return res.status(400).json({ success: false, message: 'Guide is not verified.' });
    }

    // ── PACKAGE-BASED booking (new model) ──
    let packageData = null;
    let totalAmount;

    if (packageId) {
      packageData = await packages.findById(packageId);
      if (!packageData) return res.status(404).json({ success: false, message: 'Package not found.' });
      if (!packageData.isPublished) return res.status(400).json({ success: false, message: 'Package is not available for booking.' });

      // Check date is in package.availableDates (if defined)
      const pkgDates = Array.isArray(packageData.availableDates) ? packageData.availableDates : [];
      if (pkgDates.length && !pkgDates.includes(tourDate)) {
        return res.status(400).json({ success: false, message: 'Selected date is not available for this tour.' });
      }

      // New pricing model (server-authoritative):
      //   price_adult = base price for first 2 people (included)
      //   price_child = price per extra person beyond 2
      let people = Math.max(2, parseInt(participants) || parseInt(adultCount) || 2);
      const maxGroup = parseInt(packageData.max_group_size) || 50;
      if (people > maxGroup) {
        return res.status(400).json({ success: false, message: `This tour accepts at most ${maxGroup} people.` });
      }
      const basePrice  = parseFloat(variantPrice) || packageData.price_adult || 0;
      const perExtra   = packageData.price_child || 0;
      const extras     = Math.max(0, people - 2);
      const addonsTotal = Array.isArray(addons) ? addons.reduce((s, a) => s + (parseFloat(a.price) || 0), 0) : 0;
      const subtotal = basePrice + (perExtra * extras) + addonsTotal;
      const discount = packageData.discountPercent || 0;
      totalAmount = subtotal * (1 - discount / 100);
    } else {
      // ── LEGACY day-rate booking (pricePerDay) ──
      if (!duration) return res.status(400).json({ success: false, message: 'Duration is required for non-package bookings.' });
      const availability = Array.isArray(guide.availability) ? guide.availability : [];
      if (!availability.includes(tourDate)) {
        return res.status(400).json({ success: false, message: 'Guide is not available on the selected date.' });
      }
      const pricePerDay = parseFloat(guide.pricePerDay) || 0;
      totalAmount = duration === 'half' ? pricePerDay * 0.6 : pricePerDay;
    }

    const participantCount = packageId
      ? Math.max(2, parseInt(participants) || parseInt(adultCount) || 2)
      : Math.max(1, parseInt(participants) || 1);

    const booking = {
      id: 'bk-' + uuidv4().slice(0, 8),
      touristId, guideId,
      tourDate, destination,
      duration: duration || (packageData?.duration_days === 1 ? 'full' : 'multi'),
      participants: participantCount,
      totalAmount: Math.round(totalAmount * 100) / 100,
      status: 'pending',
      specialRequests: specialRequests || '',
      createdAt: new Date().toISOString(),
      ...(packageId && {
        packageId,
        adultCount: parseInt(adultCount) || 1,
        childCount: parseInt(childCount) || 0,
        variantName: variantName || null,
        addons: Array.isArray(addons) ? addons : [],
      }),
    };

    try {
      await bookings.insert(booking);
    } catch (insertErr) {
      // Unique violation = race condition: another tourist booked the same date first
      if (insertErr.message && (insertErr.message.includes('duplicate key') || insertErr.message.includes('uniq_active_booking'))) {
        return res.status(409).json({
          success: false,
          message: 'This date was just booked by someone else. Please choose another date.',
        });
      }
      throw insertErr;
    }

    // Emails: tourist (request sent) + guide (new booking)
    const tourist = await users.findById(touristId);
    email.sendTouristBookingPending({
      email: tourist.email, name: tourist.fullName,
      guideName: guide.fullName, destination, tourDate,
      duration, totalAmount: booking.totalAmount, bookingId: booking.id,
    }).catch(() => {});
    email.sendGuideNewBooking({
      email: guide.email, name: guide.fullName,
      touristName: tourist.fullName, destination, tourDate,
      duration, participants: participantCount,
      totalAmount: booking.totalAmount, bookingId: booking.id,
    }).catch(() => {});

    // In-app notifications (bilingual EN + AR)
    notify({
      userId: guide.id,
      type: 'booking_new',
      title:   'New booking request',
      titleAr: 'طلب حجز جديد',
      body:   `${tourist.fullName} requested a tour to ${destination} on ${tourDate}.`,
      bodyAr: `طلب ${tourist.fullName} رحلة إلى ${destination} بتاريخ ${tourDate}.`,
      link: '/guide-dashboard.html#bookings',
      metadata: { bookingId: booking.id },
    });
    notify({
      userId: tourist.id,
      type: 'booking_new',
      title:   'Booking request sent',
      titleAr: 'تم إرسال طلب الحجز',
      body:   `Waiting for ${guide.fullName} to confirm your ${destination} tour on ${tourDate}.`,
      bodyAr: `في انتظار تأكيد ${guide.fullName} لرحلتك إلى ${destination} بتاريخ ${tourDate}.`,
      link: '/tourist-dashboard.html#bookings',
      metadata: { bookingId: booking.id },
    });

    res.status(201).json({ success: true, message: 'Booking request sent. Waiting for guide confirmation.', booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.myBookings = async (req, res) => {
  try {
    const touristId = req.session.userId;
    const list = await bookings.findAllByField('touristId', touristId);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const enriched = await Promise.all(list.map(async b => {
      const guide = await users.findById(b.guideId);
      return { ...b, guideName: guide ? guide.fullName : 'Unknown', guideRating: guide ? guide.rating : 0 };
    }));
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

    const enriched = await Promise.all(list.map(async b => {
      const tourist = await users.findById(b.touristId);
      return { ...b, touristName: tourist ? tourist.fullName : 'Unknown', touristEmail: tourist ? tourist.email : '' };
    }));
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

    if (userType === 'guide'   && booking.guideId   !== userId) return res.status(403).json({ success: false, message: 'Access denied.' });
    if (userType === 'tourist' && booking.touristId !== userId) return res.status(403).json({ success: false, message: 'Access denied.' });

    if (userType === 'tourist' && status === 'cancelled') {
      const hoursUntil = (new Date(booking.tourDate) - new Date()) / 36e5;
      if (hoursUntil < 48) {
        return res.status(400).json({ success: false, message: 'Cancellations must be made at least 48 hours before the tour.' });
      }
    }

    const allowedTransitions = {
      guide:   ['confirmed', 'cancelled', 'in_progress', 'completed'],
      tourist: ['cancelled'],
      admin:   ['confirmed', 'cancelled', 'in_progress', 'completed'],
    };

    if (!allowedTransitions[userType]?.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status transition.' });
    }

    // Guide can only START trip from 'confirmed' status, and only on/after tour date
    if (status === 'in_progress' && userType === 'guide') {
      if (booking.status !== 'confirmed') {
        return res.status(400).json({ success: false, message: 'Trip can only be started from a confirmed booking.' });
      }
      // Allow starting 1 day before scheduled date (for evening tours, etc.)
      const tripDate = new Date(booking.tourDate);
      const earliestStart = new Date(tripDate); earliestStart.setDate(earliestStart.getDate() - 1);
      if (new Date() < earliestStart) {
        return res.status(400).json({ success: false, message: 'Cannot start trip more than 1 day before the scheduled date.' });
      }
    }

    // Guide can only COMPLETE trip from 'in_progress' status
    if (status === 'completed' && userType === 'guide') {
      if (booking.status !== 'in_progress') {
        return res.status(400).json({ success: false, message: 'Only trips that have started can be completed.' });
      }
    }

    const updateData = { status };
    if (status === 'in_progress') updateData.startedAt = new Date().toISOString();
    if (status === 'completed')   updateData.completedAt = new Date().toISOString();

    const updated = await bookings.update(id, updateData);

    // Send emails based on new status
    const tourist = await users.findById(booking.touristId);
    const guide   = await users.findById(booking.guideId);
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
        link: '/guide-dashboard.html#bookings',
        metadata: { bookingId: id },
      });

      // Block the date in guide availability
      if (guide) {
        const avail = Array.isArray(guide.availability) ? guide.availability : [];
        if (avail.includes(booking.tourDate)) {
          await users.update(booking.guideId, { availability: avail.filter(d => d !== booking.tourDate) });
        }
      }
    } else if (status === 'cancelled') {
      if (tourist) email.sendTouristBookingCancelled({ email: tourist.email, name: tourist.fullName, guideName: guide?.fullName, ...emailData }).catch(() => {});
      if (guide)   email.sendGuideBookingCancelled({ email: guide.email, name: guide.fullName, touristName: tourist?.fullName, ...emailData }).catch(() => {});

      const cancelledBy = userType === 'guide' ? 'guide' : (userType === 'tourist' ? 'tourist' : 'admin');
      const cancelledByAr = userType === 'guide' ? 'المرشد' : (userType === 'tourist' ? 'السائح' : 'الإدارة');
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
        link: '/guide-dashboard.html#bookings',
        metadata: { bookingId: id },
      });

      // Restore the date to guide availability (the email promises this)
      if (guide) {
        const avail = Array.isArray(guide.availability) ? guide.availability : [];
        if (!avail.includes(booking.tourDate)) {
          await users.update(booking.guideId, { availability: [...avail, booking.tourDate] });
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
        link: '/guide-dashboard.html#bookings',
        metadata: { bookingId: id },
      });
    }

    res.json({ success: true, message: 'Booking updated.', booking: updated });
  } catch (err) {
    console.error(err);
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
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
