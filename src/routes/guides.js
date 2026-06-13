const router = require('express').Router();
const guide = require('../controllers/guideController');
const accounting = require('../controllers/accountingController');
const { requireGuide } = require('../middleware/auth');

router.get('/', guide.searchGuides);
router.get('/top', guide.topGuides);
// Must come before '/:id' so 'me' isn't captured as a guide id.
router.get('/me/analytics', requireGuide, guide.analytics);
router.get('/me/earnings',  requireGuide, accounting.earnings);
router.get('/me/statement', requireGuide, accounting.statementPdf);
router.get('/me/invoice/:bookingId', requireGuide, accounting.invoicePdf);
router.get('/:id', guide.getGuide);
router.put('/me/availability', requireGuide, guide.updateAvailability);
router.put('/me/profile', requireGuide, guide.updateProfile);
router.put('/me/assets', requireGuide, guide.updateAssets);

module.exports = router;
