const router = require('express').Router();
const qa = require('../controllers/qaController');
const { requireLogin, requireGuide } = require('../middleware/auth');

router.get('/guide/:guideId', qa.byGuide);
router.get('/mine',           requireGuide, qa.forMe);
router.post('/',              requireLogin, qa.ask);
router.post('/:id/answer',    requireGuide, qa.answer);

module.exports = router;
