const router = require('express').Router();
const ctrl = require('../controllers/notificationsController');
const { requireLogin } = require('../middleware/auth');

router.get('/',               requireLogin, ctrl.list);
router.get('/unread-count',   requireLogin, ctrl.unreadCount);
router.post('/:id/read',      requireLogin, ctrl.markRead);
router.post('/read-all',      requireLogin, ctrl.markAllRead);
router.get('/preferences',    requireLogin, ctrl.getPrefs);
router.put('/preferences',    requireLogin, ctrl.savePrefs);

module.exports = router;
