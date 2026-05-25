const SupabaseDB = require('../models/SupabaseDB');
const notifications = new SupabaseDB('notifications');
const users         = new SupabaseDB('users');

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
  if (!req.session.userId) return res.status(401).json({ success: false });
  const u = await users.findById(req.session.userId);
  res.json({ success: true, prefs: u?.notifPrefs || {} });
};

// PUT /api/notifications/preferences
exports.savePrefs = async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ success: false });
  const { email, inapp, whatsapp } = req.body;
  const safe = {
    email:    { bookings: !!email?.bookings,    messages: !!email?.messages,    reminders: !!email?.reminders,    marketing: !!email?.marketing },
    inapp:    { bookings: !!inapp?.bookings,    messages: !!inapp?.messages,    reminders: !!inapp?.reminders,    system:    !!inapp?.system },
    whatsapp: { bookings: !!whatsapp?.bookings, messages: !!whatsapp?.messages, reminders: !!whatsapp?.reminders, system:    !!whatsapp?.system },
  };
  await users.update(req.session.userId, { notifPrefs: safe });
  res.json({ success: true, prefs: safe });
};
