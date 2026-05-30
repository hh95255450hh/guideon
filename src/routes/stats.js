const router = require('express').Router();
const stats = require('../controllers/statsController');

// Public homepage statistics (real, live numbers). No auth required.
router.get('/public', stats.publicStats);

module.exports = router;
