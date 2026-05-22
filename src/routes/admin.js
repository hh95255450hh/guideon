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

router.get('/admins', admin.allAdmins);
router.post('/create-admin', admin.createAdmin);
router.delete('/users/:id', admin.deleteUser);

// New admin powers
router.get('/stats/extended', admin.extendedStats);
router.patch('/users/:id', admin.editUser);
router.post('/users/:id/reset-password', admin.adminResetPassword);
router.post('/bookings/:id/cancel', admin.adminCancelBooking);
router.post('/broadcast', admin.broadcastEmail);
router.delete('/reviews/:id', admin.deleteReview);
router.delete('/messages/:id', admin.deleteMessage);
router.get('/audit-log', admin.getAuditLog);
router.get('/export/:resource', admin.exportCSV);

module.exports = router;
