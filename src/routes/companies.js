const router = require('express').Router();
const guide = require('../controllers/guideController');

router.get('/top',  guide.topCompanies);
router.get('/:id',  guide.getCompany);

module.exports = router;
