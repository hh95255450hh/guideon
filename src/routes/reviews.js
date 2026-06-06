const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const review = require('../controllers/reviewController');
const { requireTourist, requireLogin, requireGuide } = require('../middleware/auth');
const { uploadBuffer } = require('../services/storageService');

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.webp'].includes(
      path.extname(file.originalname).toLowerCase()
    );
    cb(null, ok);
  },
  limits: { fileSize: 8 * 1024 * 1024 },
});

router.post('/', requireTourist, review.submitReview);
router.patch('/:reviewId/reply', requireGuide, review.replyToReview);
router.get('/guide/:guideId',     review.guideReviews);
router.get('/package/:packageId', review.packageReviews);

// POST /api/reviews/upload-photo — upload a single review photo, returns URL
router.post('/upload-photo', requireLogin, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
  try {
    const { url } = await uploadBuffer({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      folder: `reviews/${req.session.userId}`,
      contentType: req.file.mimetype,
    });
    res.json({ success: true, url });
  } catch (e) {
    console.error('[reviews:upload]', e.message);
    res.status(500).json({ success: false, message: 'Upload failed.' });
  }
});

module.exports = router;
