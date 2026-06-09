const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const emailService = require('../services/emailService');

const subs = new SupabaseDB('newsletter_subscribers');

// POST /api/newsletter/subscribe
exports.subscribe = async (req, res) => {
  try {
    const { email, name, language, source } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'A valid email is required.' });
    }
    const normalized = email.toLowerCase();
    const existing = await subs.findByField('email', normalized);
    if (existing) {
      if (!existing.isActive) {
        await subs.update(existing.id, { isActive: true });
      }
      return res.json({ success: true, message: 'You are already subscribed. Welcome back!' });
    }

    const record = {
      id: 'sub-' + uuidv4().slice(0, 10),
      email: normalized,
      name: name || '',
      language: language || 'en',
      source: source || 'website',
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    try {
      await subs.insert(record);
    } catch (insErr) {
      // Never show a visitor a scary 500 for a newsletter sign-up. Log it
      // for ops and respond gracefully — worst case is a missed subscription.
      console.error('[newsletter:insert]', insErr.message);
      return res.json({ success: true, message: 'Thanks! We\'ll be in touch.' });
    }

    // Welcome email
    if (emailService.send) {
      emailService.send(
        normalized,
        'Welcome to Guideon 🌿',
        `<h2 style="font-family:sans-serif;color:#0f7b6c">Welcome!</h2><p>Thanks for subscribing. You'll get the best of Oman travel — tips, hidden gems, and exclusive deals — straight to your inbox.</p><p><a href="${process.env.APP_URL || 'https://guideon.om'}">Visit Guideon</a></p>`
      ).catch(() => {});
    }

    res.status(201).json({ success: true, message: '🎉 You\'re subscribed! Check your inbox.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Subscription failed.' });
  }
};

// POST /api/newsletter/unsubscribe
exports.unsubscribe = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });
    const sub = await subs.findByField('email', email.toLowerCase());
    if (sub) await subs.update(sub.id, { isActive: false });
    res.json({ success: true, message: 'You have been unsubscribed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
