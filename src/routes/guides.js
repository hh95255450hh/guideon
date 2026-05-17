const router = require('express').Router();
const guide = require('../controllers/guideController');
const { requireGuide } = require('../middleware/auth');

router.get('/', guide.searchGuides);
router.get('/top', guide.topGuides);
router.get('/:id', guide.getGuide);
router.put('/me/availability', requireGuide, guide.updateAvailability);
router.put('/me/profile', requireGuide, guide.updateProfile);

module.exports = router;
