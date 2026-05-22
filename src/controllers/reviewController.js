const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const email = require('../services/emailService');

const reviews  = new SupabaseDB('reviews', 'reviewId');
const bookings = new SupabaseDB('bookings');
const users    = new SupabaseDB('users');

exports.submitReview = async (req, res) => {
  try {
    const { bookingId, rating, comment, photos } = req.body;
    const touristId = req.session.userId;

    const booking = await bookings.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (booking.touristId !== touristId) return res.status(403).json({ success: false, message: 'Access denied.' });
    if (booking.status !== 'completed') return res.status(400).json({ success: false, message: 'You can only review completed tours.' });
    if (new Date(booking.tourDate) > new Date()) return res.status(400).json({ success: false, message: 'Tour has not taken place yet.' });

    const existing = await reviews.findByField('bookingId', bookingId);
    if (existing) return res.status(409).json({ success: false, message: 'You have already reviewed this booking.' });

    const tourist = await users.findById(touristId);
    const photoList = Array.isArray(photos) ? photos.slice(0, 3) : [];

    const review = {
      reviewId: 'rv-' + uuidv4().slice(0, 8),
      bookingId, touristId,
      guideId: booking.guideId,
      rating: parseInt(rating),
      comment: comment || '',
      photos: photoList,
      helpfulCount: 0,
      touristName: tourist ? tourist.fullName : 'Anonymous',
      createdAt: new Date().toISOString(),
    };
    await reviews.insert(review);

    const guideReviews = await reviews.findAllByField('guideId', booking.guideId);
    const avg = guideReviews.reduce((s, r) => s + r.rating, 0) / guideReviews.length;
    const guide = await users.findById(booking.guideId);
    await users.update(booking.guideId, {
      rating: Math.round(avg * 10) / 10,
      totalReviews: guideReviews.length,
    });

    // Notify guide of new review
    if (guide) {
      email.sendGuideNewReview({
        email: guide.email, name: guide.fullName,
        touristName: review.touristName,
        rating: review.rating, comment: review.comment,
        destination: booking.destination,
      }).catch(() => {});
    }

    res.status(201).json({ success: true, message: 'Review submitted. Thank you!', review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.guideReviews = async (req, res) => {
  try {
    const { guideId } = req.params;
    const list = await reviews.findAllByField('guideId', guideId);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, reviews: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
