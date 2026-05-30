const { v4: uuidv4 } = require('uuid');
const SupabaseDB = require('../models/SupabaseDB');
const emailService = require('../services/emailService');

const questions = new SupabaseDB('guide_questions');
const users     = new SupabaseDB('users');

// POST /api/qa — ask a question to a guide
exports.ask = async (req, res) => {
  try {
    const { guideId, question } = req.body;
    if (!guideId || !question || question.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Question is required (min 5 chars).' });
    }

    const guide = await users.findById(guideId);
    if (!guide || guide.userType !== 'guide') {
      return res.status(404).json({ success: false, message: 'Guide not found.' });
    }

    const asker = await users.findById(req.session.userId);
    const q = {
      id: 'q-' + uuidv4().slice(0, 12),
      guideId,
      askerId: req.session.userId,
      askerName: asker?.fullName || 'Anonymous',
      question: question.trim(),
      answer: null,
      answeredAt: null,
      isPublic: true,
      createdAt: new Date().toISOString(),
    };

    const inserted = await questions.insert(q);

    // Notify guide
    if (guide.email) {
      emailService.send?.(guide.email, `New question on Guideon — ${asker?.fullName || 'a tourist'}`,
        `<p>Hi ${guide.fullName},</p><p>${asker?.fullName || 'A tourist'} asked you:</p><blockquote style="border-left:4px solid #0f7b6c;padding-left:12px;color:#333">${question}</blockquote><p><a href="${process.env.APP_URL || 'https://guideon.om'}/guide-dashboard.html">Reply on your dashboard</a></p>`
      );
    }

    res.status(201).json({ success: true, message: 'Question sent. The guide will reply soon.', question: inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/qa/:id/answer — guide answers a question
exports.answer = async (req, res) => {
  try {
    const { answer } = req.body;
    const q = await questions.findById(req.params.id);
    if (!q) return res.status(404).json({ success: false, message: 'Question not found.' });
    if (q.guideId !== req.session.userId) {
      return res.status(403).json({ success: false, message: 'Only the guide can answer.' });
    }
    if (!answer || answer.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Answer is too short.' });
    }
    const updated = await questions.update(req.params.id, {
      answer: answer.trim(),
      answeredAt: new Date().toISOString(),
    });
    res.json({ success: true, question: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/qa/guide/:guideId — public Q&A for a guide
exports.byGuide = async (req, res) => {
  try {
    const list = await questions.findAllByField('guideId', req.params.guideId);
    const visible = list
      .filter(q => q.isPublic && q.answer) // only show answered questions publicly
      .sort((a, b) => new Date(b.answeredAt) - new Date(a.answeredAt));
    res.json({ success: true, questions: visible });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/qa/mine — questions asked TO me (guide)
exports.forMe = async (req, res) => {
  try {
    const list = await questions.findAllByField('guideId', req.session.userId);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, questions: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
