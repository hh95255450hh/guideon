const router = require('express').Router();
const guide = require('../controllers/guideController');

router.get('/:id', guide.getCompany);

module.exports = router;
