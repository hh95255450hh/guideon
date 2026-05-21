const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const email = require('../services/emailService');

const bookings = new SupabaseDB('bookings');
const users    = new SupabaseDB('users');

exports.createBooking = async (req, res) => {
  try {
    const { guideId, tourDate, duration, destination, participants, specialRequests } = req.body;
    const touristId = req.session.userId;

    if (!guideId || !tourDate || !duration || !destination) {
      return res.status(400).json({ success: false, message: 'Missing required booking fields.' });
    }

    const guide = await users.findById(guideId);
    if (!guide || guide.userType !== 'guide') {
      return res.status(404).json({ success: false, message: 'Guide not found.' });
    }
    if (!guide.isVerified) {
      return res.status(400).json({ success: false, message: 'Guide is not verified.' });
    }

    const availability = Array.isArray(guide.availability) ? guide.availability : [];
    if (!availability.includes(tourDate)) {
      return res.status(400).json({ success: false, message: 'Guide is not available on the selected date.' });
    }

    const pricePerDay = parseFloat(guide.pricePerDay) || 0;
    const totalAmount = duration === 'half' ? pricePerDay * 0.6 : pricePerDay;
    const participantCount = parseInt(participants) || 1;

    const booking = {
      id: 'bk-' + uuidv4().slice(0, 8),
      touristId, guideId,
      tourDate, duration, destination,
      participants: participantCount,
      totalAmount: Math.round(totalAmount * 100) / 100,
      status: 'pending',
      specialRequests: specialRequests || '',
      createdAt: new Date().toISOString(),
    };

    await bookings.insert(booking);

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

    res.status(201).json({ success: true, message: 'Booking request sent. Waiting for guide confirmation.', booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.myBookings = async (req, res) => {
  try {
    const touristId = req.session.userId;
    const list = await bookings.findAll(b => b.touristId === touristId);
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
    const list = await bookings.findAll(b => b.guideId === guideId);
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
      guide:   ['confirmed', 'cancelled'],
      tourist: ['cancelled'],
      admin:   ['confirmed', 'cancelled', 'completed'],
    };

    if (!allowedTransitions[userType]?.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status transition.' });
    }

    const updated = await bookings.update(id, { status });

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

      // Restore the date to guide availability (the email promises this)
      if (guide) {
        const avail = Array.isArray(guide.availability) ? guide.availability : [];
        if (!avail.includes(booking.tourDate)) {
          await users.update(booking.guideId, { availability: [...avail, booking.tourDate] });
        }
      }
    } else if (status === 'completed') {
      if (tourist) email.sendTouristReviewReminder({ email: tourist.email, name: tourist.fullName, guideName: guide?.fullName, destination: booking.destination, bookingId: id }).catch(() => {});
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
