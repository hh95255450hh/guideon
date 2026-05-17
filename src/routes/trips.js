const express = require('express');
const router = express.Router();
const trip = require('../controllers/tripController');
const { requireLogin, requireTourist, requireGuide, requireAdmin } = require('../middleware/auth');

router.post('/', requireTourist, trip.createRequest);
router.get('/mine', requireTourist, trip.myRequests);
router.get('/matching', requireGuide, trip.matchingRequests);
router.get('/all', requireAdmin, trip.allRequests);
router.patch('/:id/close', requireTourist, trip.closeRequest);

module.exports = router;
