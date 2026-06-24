const router = require('express').Router();
const guide = require('../controllers/guideController');
const accounting = require('../controllers/accountingController');
const { requireGuide, requireProvider } = require('../middleware/auth');

router.get('/', guide.searchGuides);
router.get('/top', guide.topGuides);
// Must come before '/:id' so 'me' isn't captured as a guide id.
router.get('/me/analytics', requireGuide, guide.analytics);
// Accounting endpoints serve both solo guides AND companies (providers).
router.get('/me/earnings',  requireProvider, accounting.earnings);
router.get('/me/statement', requireProvider, accounting.statementPdf);
router.get('/me/invoice/:bookingId', requireProvider, accounting.invoicePdf);
router.post('/me/request-payout/:bookingId', requireProvider, accounting.requestPayout);
router.get('/:id', guide.getGuide);
router.put('/me/availability', requireGuide, guide.updateAvailability);
router.put('/me/profile', requireGuide, guide.updateProfile);
router.put('/me/assets', requireGuide, guide.updateAssets);

module.exports = router;
