const router = require('express').Router();
const pkg = require('../controllers/packageController');
const { requireLogin, requireAdmin } = require('../middleware/auth');

router.get('/',          pkg.list);
router.get('/mine',      requireLogin, pkg.mine);
router.get('/:id',       pkg.get);
router.post('/',         requireLogin, pkg.create);
router.put('/:id',       requireLogin, pkg.update);
router.delete('/:id',    requireLogin, pkg.remove);
router.patch('/:id/feature', requireAdmin, pkg.toggleFeature);

module.exports = router;
