/**
 * aiController.js — Guideon's AI features, all powered by Claude (see ai.js).
 *
 *   POST /api/ai/trip-plan          → day-by-day itinerary + real guide picks
 *   POST /api/ai/match              → "smart match" top guides for a free-text need
 *   POST /api/ai/improve            → polish a guide/company/team bio (bilingual)
 *   GET  /api/ai/reviews-summary/:guideId → AI summary of a guide's reviews
 *
 * Every endpoint degrades gracefully when ANTHROPIC_API_KEY is unset: it
 * returns a friendly bilingual "AI not configured yet" message instead of 500.
 */
const ai = require('../services/ai');
const SupabaseDB = require('../models/SupabaseDB');

const users   = new SupabaseDB('users');
const reviews = new SupabaseDB('reviews', 'reviewId');

const AI_OFF = {
  success: false,
  message: 'AI features are not enabled yet. — ميزات الذكاء الاصطناعي غير مفعّلة بعد.',
};

// Trim a guide record down to just what the model needs to reason + cite.
function guideBrief(g) {
  return {
    id: g.id,
    name: g.fullName,
    type: g.userType,
    bio: (g.bio || '').slice(0, 400),
    rating: g.rating || 0,
    reviews: g.totalReviews || 0,
    pricePerDay: g.pricePerDay || 0,
    languages: g.languages || [],
    specialisations: g.specialisations || [],
    destinations: g.destinations || [],
    verified: g.isVerified === true,
  };
}

async function activeGuides() {
  // JS-filter for "not suspended" — an eq filter on isSuspended drops NULL rows.
  const all = await users.findAllWhere({ userType: 'guide' });
  return all.filter((g) => g.isVerified === true && g.isSuspended !== true);
}

// ── POST /api/ai/trip-plan ───────────────────────────────────────────────────
exports.tripPlan = async (req, res) => {
  if (!ai.enabled) return res.status(503).json(AI_OFF);
  try {
    const { request, days, interests, budget, lang } = req.body || {};
    if (!request && !interests) {
      return res.status(400).json({ success: false, message: 'Describe your trip. — صف رحلتك.' });
    }

    const guides = (await activeGuides()).map(guideBrief);
    const arabic = lang === 'ar';

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
        days: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              day: { type: 'integer' },
              theme: { type: 'string' },
              governorate: { type: 'string' },
              activities: { type: 'array', items: { type: 'string' } },
              suggestedGuideId: { type: 'string' },
              suggestedGuideName: { type: 'string' },
              estimatedCostOMR: { type: 'number' },
            },
            required: ['day', 'theme', 'governorate', 'activities', 'suggestedGuideId', 'suggestedGuideName', 'estimatedCostOMR'],
          },
        },
        totalEstimatedOMR: { type: 'number' },
        tips: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'summary', 'days', 'totalEstimatedOMR', 'tips'],
    };

    const system = `You are Guideon's expert Oman trip planner. Build a realistic, day-by-day itinerary across the Sultanate of Oman using ONLY real destinations.
- Write all user-facing strings in ${arabic ? 'Arabic' : 'English'}.
- For each day, pick the single best-matching guide from the provided GUIDES list (match destination, language, specialisation, rating) and put their exact id in suggestedGuideId and exact name in suggestedGuideName. If no guide fits a day, use empty strings for both.
- Keep cost estimates grounded in each guide's pricePerDay (OMR). Sum them into totalEstimatedOMR.
- Be practical about geography (don't zig-zag across the country in one day) and season.`;

    const user = `GUIDES (JSON): ${JSON.stringify(guides)}

TRIP REQUEST:
- Free text: ${request || '(none)'}
- Days: ${days || 'flexible'}
- Interests: ${interests || '(none)'}
- Budget: ${budget || 'flexible'}`;

    const plan = await ai.completeJSON({
      system,
      messages: [{ role: 'user', content: user }],
      schema,
      maxTokens: 4096,
      effort: 'high',
    });

    // Attach guide photos for any cited guide so the UI can render rich cards.
    const byId = new Map((await activeGuides()).map((g) => [g.id, g]));
    (plan.days || []).forEach((d) => {
      const g = byId.get(d.suggestedGuideId);
      d.suggestedGuidePhoto = g ? g.photo || '' : '';
    });

    res.json({ success: true, plan });
  } catch (e) {
    console.error('[ai:tripPlan]', e.message);
    res.status(500).json({ success: false, message: 'Could not build a plan right now. — تعذّر إنشاء الخطة حالياً.' });
  }
};

// ── POST /api/ai/match ───────────────────────────────────────────────────────
exports.match = async (req, res) => {
  if (!ai.enabled) return res.status(503).json(AI_OFF);
  try {
    const { need, lang } = req.body || {};
    if (!need) return res.status(400).json({ success: false, message: 'Describe what you need. — صف ما تحتاجه.' });

    const guides = (await activeGuides()).map(guideBrief);
    const arabic = lang === 'ar';

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        matches: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              guideId: { type: 'string' },
              guideName: { type: 'string' },
              reason: { type: 'string' },
              score: { type: 'integer' },
            },
            required: ['guideId', 'guideName', 'reason', 'score'],
          },
        },
      },
      required: ['matches'],
    };

    const system = `You are Guideon's matchmaking engine. From the GUIDES list, pick the top 3 guides that best fit the tourist's need. Return their exact id and name, a one-sentence reason in ${arabic ? 'Arabic' : 'English'} explaining WHY each fits (language, specialisation, destination, rating), and a score 0-100. Only use guides from the list.`;

    const out = await ai.completeJSON({
      system,
      messages: [{ role: 'user', content: `GUIDES: ${JSON.stringify(guides)}\n\nNEED: ${need}` }],
      schema,
      maxTokens: 1500,
      effort: 'medium',
    });

    // Hydrate with photo + price so the client can render cards directly.
    const byId = new Map((await activeGuides()).map((g) => [g.id, g]));
    const matches = (out.matches || []).map((m) => {
      const g = byId.get(m.guideId);
      return { ...m, photo: g?.photo || '', pricePerDay: g?.pricePerDay || 0, rating: g?.rating || 0 };
    });

    res.json({ success: true, matches });
  } catch (e) {
    console.error('[ai:match]', e.message);
    res.status(500).json({ success: false, message: 'Could not match right now. — تعذّرت المطابقة حالياً.' });
  }
};

// ── POST /api/ai/improve ─────────────────────────────────────────────────────
// Polishes the logged-in provider's own bio. Returns AR + EN versions; does NOT
// auto-save — the provider reviews and saves through the normal profile flow.
exports.improve = async (req, res) => {
  if (!ai.enabled) return res.status(503).json(AI_OFF);
  if (!req.session.userId) return res.status(401).json({ success: false, message: 'Please log in. — سجّل الدخول.' });
  try {
    const { text, role } = req.body || {};
    const draft = (text || '').trim();
    if (draft.length < 10) {
      return res.status(400).json({ success: false, message: 'Write a few words first. — اكتب بضع كلمات أولاً.' });
    }
    const kind = role === 'company' ? 'tourism company' : role === 'team' ? 'events team' : 'tour guide';

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        ar: { type: 'string' },
        en: { type: 'string' },
      },
      required: ['ar', 'en'],
    };

    const system = `You are a professional tourism copywriter for Guideon (Oman). Rewrite the ${kind}'s profile bio so it is warm, trustworthy, and compelling to travellers — concise (2-4 short paragraphs), specific, no clichés, no emojis spam. Keep any real facts; do not invent licences, awards, or years of experience. Return BOTH an Arabic version (ar) and an English version (en) of the same bio.`;

    const out = await ai.completeJSON({
      system,
      messages: [{ role: 'user', content: `Original bio:\n${draft.slice(0, 2000)}` }],
      schema,
      maxTokens: 1500,
      effort: 'medium',
    });
    res.json({ success: true, ...out });
  } catch (e) {
    console.error('[ai:improve]', e.message);
    res.status(500).json({ success: false, message: 'Could not improve the text right now. — تعذّر تحسين النص حالياً.' });
  }
};

// ── GET /api/ai/reviews-summary/:guideId ─────────────────────────────────────
exports.reviewsSummary = async (req, res) => {
  if (!ai.enabled) return res.status(503).json(AI_OFF);
  try {
    const guideId = req.params.guideId;
    const lang = req.query.lang;
    const all = await reviews.findAllWhere({ guideId });
    const visible = all.filter((r) => r.isHidden !== true && (r.comment || '').trim());
    if (visible.length < 3) {
      return res.json({ success: true, summary: null, count: visible.length });
    }
    const sample = visible.slice(0, 40).map((r) => ({ rating: r.rating, comment: (r.comment || '').slice(0, 300) }));
    const arabic = lang === 'ar';

    const summary = await ai.complete({
      system: `You summarise tourist reviews for a guide on Guideon. In ${arabic ? 'Arabic' : 'English'}, write 2-3 sentences capturing the consensus: what travellers consistently praise and any recurring caveats. Be balanced and factual; don't overclaim. No bullet points.`,
      messages: [{ role: 'user', content: `Reviews (JSON): ${JSON.stringify(sample)}` }],
      maxTokens: 400,
      effort: 'low',
    });
    res.json({ success: true, summary, count: visible.length });
  } catch (e) {
    console.error('[ai:reviewsSummary]', e.message);
    res.status(500).json({ success: false, message: 'Could not summarise reviews right now. — تعذّر تلخيص المراجعات حالياً.' });
  }
};
