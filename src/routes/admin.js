const router = require('express').Router();
const admin = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

router.get('/stats', admin.stats);
router.get('/guides/pending', admin.pendingGuides);
router.get('/guides', admin.allGuides);
router.get('/tourists', admin.allTourists);
router.get('/companies/pending', admin.pendingCompanies);
router.get('/companies', admin.allCompanies);
router.get('/bookings', admin.allBookings);
router.patch('/guides/:id/verify', admin.verifyGuide);
router.patch('/companies/:id/verify', admin.verifyCompany);
router.patch('/users/:id/suspend', admin.suspendUser);
router.patch('/users/:id/unsuspend', admin.unsuspendUser);
router.patch('/bookings/:id/complete', admin.markBookingComplete);

module.exports = router;
