/**
 * Booking service — business logic for creating bookings.
 *
 * No req/res here. Inputs are plain data; outputs are plain data or a thrown
 * BookingError carrying an HTTP-friendly { status, code, message }. The
 * controller stays thin: parse request → call service → map result/error.
 */
const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const email = require('./emailService');
const { notify } = require('./notificationService');
const rules = require('../domain/bookingRules');

const bookings = new SupabaseDB('bookings');
const users    = new SupabaseDB('users');
const packages = new SupabaseDB('tour_packages');

// Columns added by migration 021 that may not exist on older deployments.
const OPTIONAL_BOOKING_COLS = ['startedAt', 'completedAt', 'variantName', 'addons', 'providerType'];
const isMissingColumnError = (msg) => /Could not find the '\w+' column|schema cache/i.test(msg || '');

class BookingError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'BookingError';
  }
}

async function insertBookingSafe(record) {
  try {
    return await bookings.insert(record);
  } catch (e) {
    if (isMissingColumnError(e.message)) {
      const clean = { ...record };
      OPTIONAL_BOOKING_COLS.forEach(c => delete clean[c]);
      return await bookings.insert(clean);
    }
    throw e;
  }
}

/**
 * Create a booking. Returns the persisted booking record.
 * Throws BookingError on validation / availability / conflict failures.
 */
async function createBooking(touristId, body) {
  const {
    guideId, tourDate, duration, tourTime: reqTourTime, destination, participants,
    specialRequests, packageId, adultCount, childCount, variantName, variantPrice,
    addons, startTime: reqStartTime,
  } = body;

  if (!guideId || !tourDate || !destination) {
    throw new BookingError(400, 'Missing required booking fields.', 'MISSING_FIELDS');
  }

  // Reject malformed dates (e.g. '2026-02-31') and dates in the past — both
  // would otherwise be stored verbatim and corrupt downstream date math.
  if (!rules.isValidDateStr(tourDate)) {
    throw new BookingError(400, 'Please choose a valid tour date.', 'INVALID_DATE');
  }
  if (rules.isPastDate(tourDate)) {
    throw new BookingError(400, 'The tour date has already passed. Please choose a future date.', 'DATE_IN_PAST');
  }

  // The booking provider can be either a solo guide OR a tour company.
  // The frontend passes the provider's user id as `guideId` for historical
  // reasons — keep accepting both user types so company package bookings
  // don't fail with "Guide not found".
  const guide = await users.findById(guideId);
  if (!guide || (guide.userType !== 'guide' && guide.userType !== 'company')) {
    throw new BookingError(404, 'Provider not found.', 'PROVIDER_NOT_FOUND');
  }
  if (!guide.isVerified) {
    throw new BookingError(400, 'Provider is not verified.', 'PROVIDER_NOT_VERIFIED');
  }

  // Concurrency capacity: a COMPANY runs several guides, so it can accept
  // multiple overlapping tours at the same time — up to a self-set cap
  // (maxConcurrentTours); if unset, it is treated as unlimited. An individual
  // guide can only run one tour per time slot (capacity = 1).
  const providerCapacity = guide.userType === 'company'
    ? (parseInt(guide.maxConcurrentTours) > 0 ? parseInt(guide.maxConcurrentTours) : Infinity)
    : 1;

  const tourTime = rules.normalizeTourTime(reqTourTime || 'full_day');
  let packageData = null;
  let totalAmount;
  let slotData = null;

  if (packageId) {
    packageData = await packages.findById(packageId);
    if (!packageData) throw new BookingError(404, 'Package not found.', 'PACKAGE_NOT_FOUND');
    if (!packageData.isPublished) throw new BookingError(400, 'Package is not available for booking.', 'PACKAGE_UNPUBLISHED');

    const pkgDates = Array.isArray(packageData.availableDates) ? packageData.availableDates : [];
    if (pkgDates.length && !pkgDates.includes(tourDate)) {
      throw new BookingError(400, 'Selected date is not available for this tour.', 'DATE_UNAVAILABLE');
    }

    let people;
    try {
      ({ totalAmount, people } = rules.calculatePackagePrice({ packageData, participants, adultCount, variantPrice, addons }));
    } catch (e) {
      throw new BookingError(400, e.message, e.code || 'PRICING_ERROR');
    }

    // Seat capacity: a package is one group departure per date. Sum the seats
    // already taken by active bookings of this package on this date and refuse
    // to oversell beyond max_group_size (the per-booking check alone can't catch
    // multiple separate bookings filling the same departure).
    const maxGroup = parseInt(packageData.max_group_size) || 50;
    const sameDeparture = await bookings.findAllByField('packageId', packageId);
    const seatsTaken = sameDeparture
      .filter(b => b.status !== 'cancelled' && b.tourDate === tourDate)
      .reduce((s, b) => s + (parseInt(b.participants) || 0), 0);
    if (seatsTaken + people > maxGroup) {
      const left = Math.max(0, maxGroup - seatsTaken);
      throw new BookingError(409,
        left > 0
          ? `Only ${left} seat(s) left for this tour on the selected date.`
          : 'This tour is fully booked on the selected date. Please choose another date.',
        'TOUR_FULL');
    }
  } else {
    const slots = Array.isArray(guide.availabilitySlots) ? guide.availabilitySlots : [];
    if (slots.length && reqStartTime) {
      // Time-slot booking
      const matchSlot = slots.find(s => s.date === tourDate && s.startTime === reqStartTime);
      if (!matchSlot) throw new BookingError(400, 'Selected time slot is not available.', 'SLOT_UNAVAILABLE');

      const existing = await bookings.findAllByField('guideId', guideId);
      const overlapCount = existing.filter(b =>
        b.status !== 'cancelled' && b.tourDate === tourDate && b.startTime && b.endTime &&
        rules.timeRangesOverlap(reqStartTime, matchSlot.endTime, b.startTime, b.endTime)
      ).length;
      // Block only when the provider's concurrent-tour capacity is reached
      // (companies can run several at once; a guide's capacity is 1).
      if (overlapCount >= providerCapacity) throw new BookingError(409, 'This time slot is fully booked. Please choose another.', 'SLOT_TAKEN');

      totalAmount = parseFloat(matchSlot.price) || 0;
      slotData = { startTime: matchSlot.startTime, endTime: matchSlot.endTime, durationMin: matchSlot.durationMin };
    } else {
      // Legacy day-rate booking
      const availability = Array.isArray(guide.availability) ? guide.availability : [];
      if (!rules.guideHasSlot(availability, tourDate, tourTime)) {
        throw new BookingError(400, 'Guide is not available for the selected date and time slot.', 'DATE_UNAVAILABLE');
      }
      const existing = await bookings.findAllByField('guideId', guideId);
      const conflicts = rules.conflictingSlots(tourTime);
      const conflictCount = existing.filter(b =>
        b.status !== 'cancelled' && b.tourDate === tourDate && conflicts.includes(b.tourTime || 'full_day')
      ).length;
      // Companies can run several overlapping tours (up to their capacity);
      // an individual guide is blocked on the first conflict (capacity = 1).
      if (conflictCount >= providerCapacity) throw new BookingError(409, 'This time slot is fully booked. Please choose another.', 'SLOT_TAKEN');

      totalAmount = rules.calculateDayRatePrice(guide.pricePerDay, tourTime);
    }
  }

  const participantCount = packageId
    ? Math.max(2, parseInt(participants) || parseInt(adultCount) || 2)
    : Math.max(1, parseInt(participants) || 1);

  // Every booking still needs the guide's approval — we never auto-confirm.
  // The only difference between fixed-price (package / slot) and custom-trip
  // bookings is how the guide responds: a ready-made tour gets Accept/Reject
  // (price is already set), while a custom trip gets a price-quote input.
  const booking = {
    id: 'bk-' + uuidv4().slice(0, 8),
    touristId, guideId, tourDate, destination, tourTime,
    providerType: guide.userType, // 'guide' | 'company' — drives the unique-index scope
    ...(slotData || {}),
    duration: packageId ? (packageData?.duration_days === 1 ? 'full' : 'multi') : (tourTime === 'full_day' ? 'full' : 'half'),
    participants: participantCount,
    totalAmount: rules.roundMoney(totalAmount),
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
    await insertBookingSafe(booking);
  } catch (insertErr) {
    if (insertErr.message && (insertErr.message.includes('duplicate key') || insertErr.message.includes('uniq_active_'))) {
      const msg = booking.startTime
        ? 'This time slot was just booked by someone else. Please choose another slot.'
        : 'This date was just booked by someone else. Please choose another date.';
      throw new BookingError(409, msg, 'SLOT_TAKEN');
    }
    throw insertErr;
  }

  // Side effects (never block / fail the booking)
  _notifyBookingCreated({ booking, guide, touristId, destination, tourDate, duration, participantCount }).catch(() => {});

  return booking;
}

async function _notifyBookingCreated({ booking, guide, touristId, destination, tourDate, duration, participantCount }) {
  const tourist = await users.findById(touristId);
  if (!tourist) return;

  // A booking carrying a packageId or a fixed startTime came from a ready-made
  // listing where the price is already known — the guide only needs to
  // accept/decline. Custom trip requests (no packageId, no startTime) need a
  // price quote from the guide.
  const isFixedPrice = !!booking.packageId || !!booking.startTime;

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

  // Route the provider to their own dashboard (company vs guide).
  const providerLink = guide.userType === 'company'
    ? '/company-dashboard.html#bookings'
    : '/guide-dashboard.html#bookings';

  if (isFixedPrice) {
    notify({
      userId: guide.id, type: 'booking_new',
      title: 'New booking request 📅', titleAr: 'طلب حجز جديد 📅',
      body: `${tourist.fullName} booked your ${destination} tour on ${tourDate}. Accept or decline.`,
      bodyAr: `حجز ${tourist.fullName} رحلتك إلى ${destination} بتاريخ ${tourDate}. اقبل أو ارفض.`,
      link: providerLink, metadata: { bookingId: booking.id },
    });
    notify({
      userId: tourist.id, type: 'booking_new',
      title: 'Booking request sent', titleAr: 'تم إرسال طلب الحجز',
      body: `Waiting for ${guide.fullName} to confirm your ${destination} tour on ${tourDate}.`,
      bodyAr: `في انتظار ${guide.fullName} لتأكيد رحلتك إلى ${destination} بتاريخ ${tourDate}.`,
      link: '/tourist-dashboard.html#bookings', metadata: { bookingId: booking.id },
    });
  } else {
    notify({
      userId: guide.id, type: 'booking_new',
      title: 'New trip request — please send a price', titleAr: 'طلب رحلة جديد — يرجى تحديد السعر',
      body: `${tourist.fullName} requested a tour to ${destination} on ${tourDate}.`,
      bodyAr: `طلب ${tourist.fullName} رحلة إلى ${destination} بتاريخ ${tourDate}.`,
      link: providerLink, metadata: { bookingId: booking.id },
    });
    notify({
      userId: tourist.id, type: 'booking_new',
      title: 'Trip request sent', titleAr: 'تم إرسال طلب الرحلة',
      body: `Waiting for ${guide.fullName} to send a price for your ${destination} trip on ${tourDate}.`,
      bodyAr: `في انتظار ${guide.fullName} لإرسال السعر لرحلتك إلى ${destination} بتاريخ ${tourDate}.`,
      link: '/tourist-dashboard.html#bookings', metadata: { bookingId: booking.id },
    });
  }
}

module.exports = { createBooking, BookingError };
