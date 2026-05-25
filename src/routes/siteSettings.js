const router = require('express').Router();
const ctrl = require('../controllers/siteSettingsController');
const { requireLogin } = require('../middleware/auth');

// Public reads
router.get('/',          ctrl.getAll);
router.get('/:key',      ctrl.getOne);

// Admin writes (auth checked inside the controller too)
router.put('/:key',      requireLogin, ctrl.update);

module.exports = router;
