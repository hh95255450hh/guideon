/**
 * Event teams — a provider vertical for crews running events/activities.
 * Teams reuse the users table (userType='team') + a team_events table.
 */
const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const { sanitizeContact } = require('../utils/sanitizeContact');

const users  = new SupabaseDB('users');
const events = new SupabaseDB('team_events');

const CATEGORIES = ['cultural', 'sports', 'music', 'adventure', 'kids', 'food', 'arts', 'other'];

function sanitizeSocials(s) {
  if (!s || typeof s !== 'object') return {};
  const out = {};
  for (const k of ['instagram', 'x', 'twitter', 'youtube', 'tiktok', 'website', 'whatsapp']) {
    if (typeof s[k] === 'string') {
      const v = s[k].trim().slice(0, 200);
      if (v) out[k] = v;
    }
  }
  return out;
}

// ── Public: list verified teams ───────────────────────────────────────────────
exports.listTeams = async (req, res) => {
  try {
    const { category, governorate } = req.query;
    let teams = await users.findAllWhere({ userType: 'team', isSuspended: false });
    teams = teams.filter(t => t.isVerified); // only show verified teams publicly
    if (category)    teams = teams.filter(t => (t.teamCategory || '').toLowerCase() === category.toLowerCase());
    if (governorate) teams = teams.filter(t => (t.teamGovernorate || '').toLowerCase().includes(governorate.toLowerCase()));
    teams.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const safe = teams.map(({ password, ...t }) => sanitizeContact(t, req.user));
    res.json({ success: true, count: safe.length, teams: safe, categories: CATEGORIES });
  } catch (err) {
    console.error('[team:listTeams]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── Public: one team + its published events ───────────────────────────────────
exports.getTeam = async (req, res) => {
  try {
    const team = await users.findById(req.params.id);
    if (!team || team.userType !== 'team') {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }
    let evs = [];
    try {
      evs = (await events.findAllByField('teamId', team.id)).filter(e => e.isPublished);
      evs.sort((a, b) => new Date(a.eventDate || 0) - new Date(b.eventDate || 0));
    } catch { /* table may not exist yet */ }
    const { password, ...safe } = team;
    res.json({ success: true, team: sanitizeContact(safe, req.user), events: evs });
  } catch (err) {
    console.error('[team:getTeam]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── Public: all upcoming published events ─────────────────────────────────────
exports.listEvents = async (req, res) => {
  try {
    const { category, governorate } = req.query;
    let evs = [];
    try { evs = await events.findAllByField('isPublished', true); } catch { evs = []; }
    if (category)    evs = evs.filter(e => (e.category || '').toLowerCase() === category.toLowerCase());
    if (governorate) evs = evs.filter(e => (e.governorate || '').toLowerCase().includes(governorate.toLowerCase()));
    // Enrich with team name
    const teamIds = [...new Set(evs.map(e => e.teamId))];
    const teams = await users.findByIds(teamIds);
    const byId = Object.fromEntries(teams.map(t => [t.id, t]));
    evs.sort((a, b) => new Date(a.eventDate || 0) - new Date(b.eventDate || 0));
    const out = evs.map(e => ({ ...e, teamName: byId[e.teamId]?.teamName || 'Team', teamPhoto: byId[e.teamId]?.photo || '' }));
    res.json({ success: true, count: out.length, events: out, categories: CATEGORIES });
  } catch (err) {
    console.error('[team:listEvents]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── Team: update own profile ──────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const teamId = req.session.userId;
    const b = req.body || {};
    const changes = {};
    if (b.teamName !== undefined)        changes.teamName = String(b.teamName).slice(0, 120);
    if (b.teamCategory !== undefined)    changes.teamCategory = CATEGORIES.includes(b.teamCategory) ? b.teamCategory : 'other';
    if (b.teamDescription !== undefined) changes.teamDescription = String(b.teamDescription).slice(0, 2000);
    if (b.teamGovernorate !== undefined) changes.teamGovernorate = String(b.teamGovernorate).slice(0, 80);
    if (b.membersCount !== undefined)    changes.membersCount = parseInt(b.membersCount) || null;
    if (b.foundedYear !== undefined)     changes.foundedYear = parseInt(b.foundedYear) || null;
    if (b.phone !== undefined)           changes.phone = String(b.phone).slice(0, 40);
    if (b.teamSocials !== undefined)     changes.teamSocials = sanitizeSocials(b.teamSocials);

    const updated = await users.update(teamId, changes);
    const { password, ...safe } = updated || {};
    res.json({ success: true, message: 'Profile updated. — تم تحديث الملف.', team: safe });
  } catch (err) {
    console.error('[team:updateProfile]', err.message);
    res.status(500).json({ success: false, message: "Couldn't save your changes. — تعذّر حفظ التعديلات." });
  }
};

// ── Team: list own events ─────────────────────────────────────────────────────
exports.myEvents = async (req, res) => {
  try {
    const list = await events.findAllByField('teamId', req.session.userId);
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    res.json({ success: true, events: list, categories: CATEGORIES });
  } catch (err) {
    console.error('[team:myEvents]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

function buildEventRecord(b) {
  return {
    title:       String(b.title || '').slice(0, 160),
    titleAr:     b.titleAr ? String(b.titleAr).slice(0, 160) : null,
    category:    CATEGORIES.includes(b.category) ? b.category : 'other',
    description: b.description ? String(b.description).slice(0, 4000) : null,
    governorate: b.governorate ? String(b.governorate).slice(0, 80) : null,
    location:    b.location ? String(b.location).slice(0, 200) : null,
    eventDate:   b.eventDate ? String(b.eventDate).slice(0, 10) : null,
    startTime:   b.startTime ? String(b.startTime).slice(0, 10) : null,
    endTime:     b.endTime ? String(b.endTime).slice(0, 10) : null,
    ticketPrice: Math.max(0, parseFloat(b.ticketPrice) || 0),
    capacity:    parseInt(b.capacity) || null,
    coverImage:  b.coverImage ? String(b.coverImage).slice(0, 600) : null,
    gallery:     Array.isArray(b.gallery) ? b.gallery.slice(0, 12) : [],
    isPublished: !!b.isPublished,
  };
}

// ── Team: create event ────────────────────────────────────────────────────────
exports.createEvent = async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.title || !String(b.title).trim()) {
      return res.status(400).json({ success: false, message: 'Event title is required. — عنوان الفعاليّة مطلوب.' });
    }
    const record = {
      id: 'evt-' + uuidv4().slice(0, 10),
      teamId: req.session.userId,
      ...buildEventRecord(b),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = await events.insert(record);
    res.status(201).json({ success: true, event: saved || record });
  } catch (err) {
    console.error('[team:createEvent]', err.message);
    if (/team_events|relation|column|schema cache/i.test(String(err.message))) {
      return res.status(500).json({ success: false, message: 'Events need migration 039 — run it in Supabase, then retry.' });
    }
    res.status(500).json({ success: false, message: "Couldn't save the event. — تعذّر حفظ الفعاليّة." });
  }
};

// ── Team: update own event ────────────────────────────────────────────────────
exports.updateEvent = async (req, res) => {
  try {
    const ev = await events.findById(req.params.id);
    if (!ev || ev.teamId !== req.session.userId) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }
    const changes = { ...buildEventRecord({ ...ev, ...req.body }), updatedAt: new Date().toISOString() };
    const saved = await events.update(req.params.id, changes);
    res.json({ success: true, event: saved });
  } catch (err) {
    console.error('[team:updateEvent]', err.message);
    res.status(500).json({ success: false, message: "Couldn't update the event. — تعذّر تحديث الفعاليّة." });
  }
};

// ── Team: delete own event ────────────────────────────────────────────────────
exports.deleteEvent = async (req, res) => {
  try {
    const ev = await events.findById(req.params.id);
    if (!ev || ev.teamId !== req.session.userId) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }
    await events.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[team:deleteEvent]', err.message);
    res.status(500).json({ success: false, message: "Couldn't delete the event. — تعذّر حذف الفعاليّة." });
  }
};
