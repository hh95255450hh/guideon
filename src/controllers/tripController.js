const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');

const tripRequests = new SupabaseDB('trip_requests');
const users        = new SupabaseDB('users');

exports.createRequest = async (req, res) => {
  try {
    const touristId = req.session.userId;
    const tourist = await users.findById(touristId);
    if (!tourist) return res.status(401).json({ success: false, message: 'Not authenticated.' });

    const { destination, startDate, endDate, groupSize, language, specialisation, budget, notes } = req.body;
    if (!destination || !startDate) {
      return res.status(400).json({ success: false, message: 'Destination and start date are required.' });
    }

    const request = {
      id: 'trip-' + Date.now(),
      touristId,
      touristName:  tourist.fullName,
      touristEmail: tourist.email,
      destination,
      startDate,
      endDate:        endDate || '',
      groupSize:      parseInt(groupSize) || 1,
      language:       language || '',
      specialisation: specialisation || '',
      budget:         budget || '',
      notes:          notes || '',
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    await tripRequests.insert(request);
    res.status(201).json({ success: true, message: 'Trip request posted.', request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.myRequests = async (req, res) => {
  try {
    const touristId = req.session.userId;
    const list = await tripRequests.findAll(t => t.touristId === touristId);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, requests: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.matchingRequests = async (req, res) => {
  try {
    const guideId = req.session.userId;
    const guide = await users.findById(guideId);
    if (!guide) return res.status(401).json({ success: false, message: 'Not authenticated.' });

    const open = await tripRequests.findAll(t => t.status === 'open');
    const matched = open.filter(t => {
      const destMatch = !t.destination || (guide.destinations || []).some(d => d.toLowerCase().includes(t.destination.toLowerCase()));
      const langMatch = !t.language    || (guide.languages    || []).some(l => l.toLowerCase().includes(t.language.toLowerCase()));
      return destMatch || langMatch;
    });
    matched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, requests: matched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.allRequests = async (req, res) => {
  try {
    const all = await tripRequests.readAll();
    all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, requests: all });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.closeRequest = async (req, res) => {
  try {
    const touristId = req.session.userId;
    const request = await tripRequests.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
    if (request.touristId !== touristId) return res.status(403).json({ success: false, message: 'Forbidden.' });
    await tripRequests.update(req.params.id, { status: 'closed' });
    res.json({ success: true, message: 'Request closed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
