const SupabaseDB = require('../models/SupabaseDB');
const push = require('../services/pushService');
const notifications = new SupabaseDB('notifications');
const users         = new SupabaseDB('users');

// GET /api/notifications/vapid-key — public key the browser needs to subscribe
exports.vapidKey = (req, res) => {
  res.json({ success: true, enabled: push.isEnabled(), key: push.publicKey() });
};

// POST /api/notifications/subscribe  { subscription }
exports.subscribe = async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const { subscription } = req.body || {};
    await push.saveSubscription(req.session.userId, subscription, req.headers['user-agent']);
    res.json({ success: true });
  } catch (e) {
    console.error('[notifications:subscribe]', e.message);
    res.status(400).json({ success: false, message: 'Could not save subscription.' });
  }
};

// POST /api/notifications/unsubscribe  { endpoint }
exports.unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (endpoint) await push.removeByEndpoint(endpoint);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: true });
  }
};

// GET /api/notifications — list + unread count for the signed-in user
exports.list = async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const all = await notifications.findAllByField('userId', req.session.userId);
    all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const recent = all.slice(0, 30);
    const unread = all.filter(n => !n.isRead).length;
    res.json({ success: true, unread, notifications: recent });
  } catch (e) {
    console.error('[notifications:list]', e.message);
    res.status(500).json({ success: false, message: 'Failed to load.' });
  }
};

// GET /api/notifications/unread-count — lightweight (for polling)
exports.unreadCount = async (req, res) => {
  try {
    if (!req.session.userId) return res.json({ success: false, unread: 0 });
    const all = await notifications.findAllByField('userId', req.session.userId);
    const unread = all.filter(n => !n.isRead).length;
    res.json({ success: true, unread });
  } catch (e) {
    res.json({ success: false, unread: 0 });
  }
};

// POST /api/notifications/:id/read
exports.markRead = async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const n = await notifications.findById(req.params.id);
    if (!n || n.userId !== req.session.userId) return res.status(404).json({ success: false });
    await notifications.update(req.params.id, { isRead: true, readAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
};

// POST /api/notifications/read-all
exports.markAllRead = async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const all = await notifications.findAllByField('userId', req.session.userId);
    const unread = all.filter(n => !n.isRead);
    await Promise.all(unread.map(n =>
      notifications.update(n.id, { isRead: true, readAt: new Date().toISOString() })
    ));
    res.json({ success: true, count: unread.length });
  } catch (e) {
    res.status(500).json({ success: false });
  }
};

// GET /api/notifications/preferences
exports.getPrefs = async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const u = await users.findById(req.session.userId);
    res.json({ success: true, prefs: u?.notifPrefs || {} });
  } catch (e) {
    console.error('[notifications:getPrefs]', e.message);
    res.status(500).json({ success: false, message: 'Failed to load preferences.' });
  }
};

// PUT /api/notifications/preferences
exports.savePrefs = async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const { email, inapp, whatsapp } = req.body || {};
    const safe = {
      email:    { bookings: !!email?.bookings,    messages: !!email?.messages,    reminders: !!email?.reminders,    marketing: !!email?.marketing },
      inapp:    { bookings: !!inapp?.bookings,    messages: !!inapp?.messages,    reminders: !!inapp?.reminders,    system:    !!inapp?.system },
      whatsapp: { bookings: !!whatsapp?.bookings, messages: !!whatsapp?.messages, reminders: !!whatsapp?.reminders, system:    !!whatsapp?.system },
    };
    await users.update(req.session.userId, { notifPrefs: safe });
    res.json({ success: true, prefs: safe });
  } catch (e) {
    console.error('[notifications:savePrefs]', e.message);
    res.status(500).json({ success: false, message: 'Failed to save preferences.' });
  }
};
