const fs = require('fs');
const path = require('path');
const SupabaseDB = require('../models/SupabaseDB');

// Stored in the existing site_settings table under keys content_<name>,
// so no new migration is required. Falls back to the bundled static JSON
// in /public/data the first time (before an admin has ever saved).
const settings = new SupabaseDB('site_settings', 'key');

// Whitelist of editable content collections → their static seed file.
const CONTENT = {
  regions: 'regions.json',
  trails:  'trails.json',
  blog:    'blog.json',
};

function staticData(name) {
  try {
    const file = path.join(__dirname, '..', '..', 'public', 'data', CONTENT[name]);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return null; }
}

// GET /api/content/:key — public. DB value if an admin has saved one,
// otherwise the bundled static JSON.
exports.get = async (req, res) => {
  try {
    const key = req.params.key;
    if (!CONTENT[key]) return res.status(404).json({ success: false, message: 'Unknown content.' });

    let data = null;
    try {
      const row = await settings.findById('content_' + key);
      if (row && row.value) data = row.value;
    } catch { /* table/row may not exist yet */ }

    if (!data) data = staticData(key);
    res.json({ success: true, key, data });
  } catch (err) {
    console.error('[content:get]', err.message);
    res.status(500).json({ success: false, message: 'Failed to load content.' });
  }
};

// PUT /api/admin/content/:key — admin/staff only. Saves the whole JSON.
exports.save = async (req, res) => {
  try {
    if (req.session.userType !== 'admin' && req.session.userType !== 'staff') {
      return res.status(403).json({ success: false, message: 'Admin only.' });
    }
    const key = req.params.key;
    if (!CONTENT[key]) return res.status(400).json({ success: false, message: 'Unknown content key.' });

    const value = req.body.data || req.body.value || req.body;
    if (!value || typeof value !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid content payload.' });
    }

    const dbKey = 'content_' + key;
    const patch = { value, updated_by: req.session.userId, updatedAt: new Date().toISOString() };
    const existing = await settings.findById(dbKey);
    if (existing) await settings.update(dbKey, patch);
    else          await settings.insert({ key: dbKey, ...patch });

    res.json({ success: true, message: 'Saved.', key, data: value });
  } catch (err) {
    console.error('[content:save]', err.message);
    res.status(500).json({ success: false, message: 'Failed to save: ' + err.message });
  }
};

// POST /api/admin/content/:key/reset — restore the bundled static JSON.
exports.reset = async (req, res) => {
  try {
    if (req.session.userType !== 'admin' && req.session.userType !== 'staff') {
      return res.status(403).json({ success: false, message: 'Admin only.' });
    }
    const key = req.params.key;
    if (!CONTENT[key]) return res.status(400).json({ success: false, message: 'Unknown content key.' });
    const data = staticData(key);
    const dbKey = 'content_' + key;
    const patch = { value: data, updated_by: req.session.userId, updatedAt: new Date().toISOString() };
    const existing = await settings.findById(dbKey);
    if (existing) await settings.update(dbKey, patch);
    else          await settings.insert({ key: dbKey, ...patch });
    res.json({ success: true, message: 'Reset to defaults.', data });
  } catch (err) {
    console.error('[content:reset]', err.message);
    res.status(500).json({ success: false, message: 'Failed to reset.' });
  }
};
