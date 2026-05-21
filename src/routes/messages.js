const express = require('express');
const { requireLogin } = require('../middleware/auth');
const { send, conversations, thread, unreadCount } = require('../controllers/messagesController');

const router = express.Router();

router.use(requireLogin);

router.post('/',                   send);
router.get('/conversations',       conversations);
router.get('/thread/:otherId',     thread);
router.get('/unread-count',        unreadCount);

module.exports = router;
