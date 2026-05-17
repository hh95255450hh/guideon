const router = require('express').Router();
const review = require('../controllers/reviewController');
const { requireTourist } = require('../middleware/auth');

router.post('/', requireTourist, review.submitReview);
router.get('/guide/:guideId', review.guideReviews);

module.exports = router;
