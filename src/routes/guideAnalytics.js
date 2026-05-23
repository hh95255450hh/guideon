const router = require('express').Router();
const ctrl = require('../controllers/guideAnalyticsController');
const { requireLogin } = require('../middleware/auth');

// Public — visitors record views on tour pages
router.post('/views/:id', ctrl.recordView);

// Guide-only
router.get('/guide/analytics', requireLogin, ctrl.guideAnalytics);
router.get('/guide/payouts',   requireLogin, ctrl.guidePayouts);

module.exports = router;
