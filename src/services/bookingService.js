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
const OPTIONAL_BOOKING_COLS = ['startedAt', 'completedAt', 'variantName', 'addons'];
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

  const guide = await users.findById(guideId);
  if (!guide || guide.userType !== 'guide') {
    throw new BookingError(404, 'Guide not found.', 'GUIDE_NOT_FOUND');
  }
  if (!guide.isVerified) {
    throw new BookingError(400, 'Guide is not verified.', 'GUIDE_NOT_VERIFIED');
  }

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

    try {
      ({ totalAmount } = rules.calculatePackagePrice({ packageData, participants, adultCount, variantPrice, addons }));
    } catch (e) {
      throw new BookingError(400, e.message, e.code || 'PRICING_ERROR');
    }
  } else {
    const slots = Array.isArray(guide.availabilitySlots) ? guide.availabilitySlots : [];
    if (slots.length && reqStartTime) {
      // Time-slot booking
      const matchSlot = slots.find(s => s.date === tourDate && s.startTime === reqStartTime);
      if (!matchSlot) throw new BookingError(400, 'Selected time slot is not available.', 'SLOT_UNAVAILABLE');

      const existing = await bookings.findAllByField('guideId', guideId);
      const hasOverlap = existing.some(b =>
        b.status !== 'cancelled' && b.tourDate === tourDate && b.startTime && b.endTime &&
        rules.timeRangesOverlap(reqStartTime, matchSlot.endTime, b.startTime, b.endTime)
      );
      if (hasOverlap) throw new BookingError(409, 'This time slot was just booked. Please choose another.', 'SLOT_TAKEN');

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
      const hasConflict = existing.some(b =>
        b.status !== 'cancelled' && b.tourDate === tourDate && conflicts.includes(b.tourTime || 'full_day')
      );
      if (hasConflict) throw new BookingError(409, 'This time slot was just booked. Please choose another.', 'SLOT_TAKEN');

      totalAmount = rules.calculateDayRatePrice(guide.pricePerDay, tourTime);
    }
  }

  const participantCount = packageId
    ? Math.max(2, parseInt(participants) || parseInt(adultCount) || 2)
    : Math.max(1, parseInt(participants) || 1);

  const booking = {
    id: 'bk-' + uuidv4().slice(0, 8),
    touristId, guideId, tourDate, destination, tourTime,
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
    if (insertErr.message && (insertErr.message.includes('duplicate key') || insertErr.message.includes('uniq_active_booking'))) {
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

  notify({
    userId: guide.id, type: 'booking_new',
    title: 'New booking request', titleAr: 'طلب حجز جديد',
    body: `${tourist.fullName} requested a tour to ${destination} on ${tourDate}.`,
    bodyAr: `طلب ${tourist.fullName} رحلة إلى ${destination} بتاريخ ${tourDate}.`,
    link: '/guide-dashboard.html#bookings', metadata: { bookingId: booking.id },
  });
  notify({
    userId: tourist.id, type: 'booking_new',
    title: 'Booking request sent', titleAr: 'تم إرسال طلب الحجز',
    body: `Waiting for ${guide.fullName} to confirm your ${destination} tour on ${tourDate}.`,
    bodyAr: `في انتظار تأكيد ${guide.fullName} لرحلتك إلى ${destination} بتاريخ ${tourDate}.`,
    link: '/tourist-dashboard.html#bookings', metadata: { bookingId: booking.id },
  });
}

module.exports = { createBooking, BookingError };
