const router = require('express').Router();
const { body } = require('express-validator');
const {
  listTours, getTour, createTour, updateTour, deleteTour, addTourImage,
} = require('../controllers/tourController');
const { getTourReviews } = require('../controllers/reviewController');
const {
  addAvailability, getAvailability, deleteAvailability, updateAvailability,
} = require('../controllers/availabilityController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { validate } = require('../middleware/errorHandler');
const { uploadTourImage, getFileUrl } = require('../services/uploadService');

const tourRules = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('location').trim().notEmpty().withMessage('Location is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('duration_days').isInt({ min: 1 }).withMessage('Duration must be at least 1 day'),
  body('max_participants').isInt({ min: 1 }).withMessage('Max participants must be at least 1'),
];

// ── Public ───────────────────────────────────────────────────────────────────
router.get('/', listTours);
router.get('/:id', getTour);
router.get('/:id/availability', getAvailability);
router.get('/:tourId/reviews', getTourReviews);

// ── Protected ────────────────────────────────────────────────────────────────
router.post(
  '/',
  authenticate, authorize('company', 'admin'),
  tourRules, validate,
  createTour
);

router.put(
  '/:id',
  authenticate, authorize('company', 'admin'),
  updateTour
);

router.delete(
  '/:id',
  authenticate, authorize('admin'),
  deleteTour
);

// Tour images — accepts URL body or multipart file upload
router.post(
  '/:id/images',
  authenticate, authorize('company', 'admin'),
  uploadTourImage,
  (req, res, next) => {
    // If a file was uploaded, inject its URL into the body
    if (req.file) {
      req.body.url = getFileUrl(req, req.file);
    }
    next();
  },
  body('url').isURL().withMessage('Valid image URL required'),
  validate,
  addTourImage
);

// Tour image delete
router.delete(
  '/:id/images/:imageId',
  authenticate, authorize('company', 'admin'),
  async (req, res, next) => {
    try {
      const { query } = require('../config/database');
      const result = await query(
        'DELETE FROM tour_images WHERE id = $1 AND tour_id = $2 RETURNING id',
        [req.params.imageId, req.params.id]
      );
      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'Image not found' });
      }
      res.json({ success: true, message: 'Image deleted' });
    } catch (err) {
      next(err);
    }
  }
);

// ── Availability ─────────────────────────────────────────────────────────────
router.post(
  '/:id/availability',
  authenticate, authorize('company', 'admin'),
  addAvailability
);

router.patch(
  '/:id/availability/:availId',
  authenticate, authorize('company', 'admin'),
  body('available_spots').isInt({ min: 0 }),
  validate,
  updateAvailability
);

router.delete(
  '/:id/availability/:availId',
  authenticate, authorize('company', 'admin'),
  deleteAvailability
);

module.exports = router;
