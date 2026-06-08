const router = require('express').Router();
const content = require('../controllers/contentController');

// Public read — regions / trails / blog
router.get('/:key', content.get);

module.exports = router;
