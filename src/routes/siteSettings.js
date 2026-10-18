const router = require('express').Router();
const ctrl = require('../controllers/siteSettingsController');
const { requireAdmin } = require('../middleware/auth');

// Public reads
router.get('/',          ctrl.getAll);
router.get('/:key',      ctrl.getOne);

// Admin writes (auth checked inside the controller too)
router.put('/:key',      requireAdmin, ctrl.update);   // loads req.user for the permission check

module.exports = router;
