const express = require('express');
const { requireLogin } = require('../middleware/auth');
const { send, conversations, thread, unreadCount, typing, stream, supportAgent } = require('../controllers/messagesController');

const router = express.Router();

router.use(requireLogin);

router.get('/stream',              stream);          // SSE real-time channel
router.get('/support-agent',       supportAgent);    // who to message for help
router.post('/',                   send);
router.post('/typing',             typing);
router.get('/conversations',       conversations);
router.get('/thread/:otherId',     thread);
router.get('/unread-count',        unreadCount);

module.exports = router;
