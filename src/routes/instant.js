const express = require('express');
const router  = express.Router();
const instant = require('../controllers/instantController');
const { requireGuide, requireTourist } = require('../middleware/auth');

router.get('/guides',                 instant.nearby);
router.get('/me',                     requireGuide,   instant.myState);
router.put('/me/availability',        requireGuide,   instant.setAvailability);
router.get('/requests/incoming',      requireGuide,   instant.incoming);
router.post('/requests/:id/accept',   requireGuide,   instant.accept);
router.post('/requests/:id/decline',  requireGuide,   instant.decline);
router.get('/requests/mine',          requireTourist, instant.myRequests);
router.post('/requests',              requireTourist, instant.createRequest);
router.post('/requests/:id/cancel',   requireTourist, instant.cancel);

module.exports = router;
