const SupabaseDB = require('../models/SupabaseDB');
const settings = new SupabaseDB('site_settings', 'key');

// GET /api/site-settings — public, returns all settings
exports.getAll = async (req, res) => {
  try {
    const all = await settings.readAll();
    const map = {};
    for (const r of all) map[r.key] = r.value;
    res.json({ success: true, settings: map });
  } catch (err) {
    console.error('[site-settings:getAll]', err.message);
    res.status(500).json({ success: false, message: 'Failed to load settings.' });
  }
};

// GET /api/site-settings/:key — public, returns one setting
exports.getOne = async (req, res) => {
  try {
    const row = await settings.findById(req.params.key);
    if (!row) return res.json({ success: true, value: null });
    res.json({ success: true, value: row.value });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
};

// PUT /api/admin/site-settings/:key — admin only, upsert value
exports.update = async (req, res) => {
  try {
    if (req.session.userType !== 'admin' && req.session.userType !== 'staff') {
      return res.status(403).json({ success: false, message: 'Admin only.' });
    }
    const { key } = req.params;
    if (!['hero','carousel','activities','theme','footer','navbar'].includes(key)) {
      return res.status(400).json({ success: false, message: 'Unknown setting key.' });
    }
    const value = req.body.value || req.body;
    const existing = await settings.findById(key);
    if (existing) {
      await settings.update(key, { value, updated_by: req.session.userId, updatedAt: new Date().toISOString() });
    } else {
      await settings.insert({ key, value, updated_by: req.session.userId, updatedAt: new Date().toISOString() });
    }
    res.json({ success: true, message: 'Saved.', value });
  } catch (err) {
    console.error('[site-settings:update]', err.message);
    res.status(500).json({ success: false, message: "Couldn't save right now. Please try again. — تعذّر الحفظ، حاول مجدداً." });
  }
};
