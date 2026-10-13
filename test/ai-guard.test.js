const test = require('node:test');
const assert = require('node:assert');

// The AI endpoints spend real money and were open with no input cap and no
// daily limit. These tests cover the guard, the review-summary cache, the
// grounding of model output in real guides, and refusal handling — with the
// model and database replaced by fakes, so no API call is ever made.

const guard = require('../src/middleware/aiGuard');

function hit(req) {
  return new Promise(resolve => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); } };
    guard.aiGuard({ headers: {}, session: {}, ip: '1.1.1.1', body: { request: 'Nizwa fort' }, ...req }, res, () => resolve({ status: 'next' }));
  });
}
function resetGuard() { guard._state.global = 0; guard._state.perKey.clear(); guard._state.day = guard._omanDay(); }

test('ai guard: an oversized field is refused with 413 before any spend', async () => {
  resetGuard();
  const r = await hit({ body: { request: 'x'.repeat(guard.MAX_FIELD_CHARS + 1) } });
  assert.strictEqual(r.status, 413);
  assert.strictEqual(guard._state.global, 0, 'a refused request spends nothing');
});

test('ai guard: an oversized body by content-length is refused', async () => {
  resetGuard();
  const r = await hit({ headers: { 'content-length': String(guard.MAX_BODY_BYTES + 1) } });
  assert.strictEqual(r.status, 413);
});

test('ai guard: an anonymous visitor gets a daily quota, then is asked to sign in', async () => {
  resetGuard();
  process.env.AI_DAILY_PER_IP = '3';
  for (let i = 0; i < 3; i++) assert.strictEqual((await hit({ ip: '9.9.9.9' })).status, 'next');
  const over = await hit({ ip: '9.9.9.9' });
  assert.strictEqual(over.status, 429);
  assert.match(over.body.message, /Sign in/);
  assert.strictEqual((await hit({ ip: '8.8.8.8' })).status, 'next', 'another visitor is unaffected');
  delete process.env.AI_DAILY_PER_IP;
});

test('ai guard: a signed-in user is counted by account, not by IP', async () => {
  resetGuard();
  process.env.AI_DAILY_PER_USER = '2';
  await hit({ session: { userId: 'u1' }, ip: 'a' });
  await hit({ session: { userId: 'u1' }, ip: 'b' });           // same account, new IP
  assert.strictEqual((await hit({ session: { userId: 'u1' }, ip: 'c' })).status, 429);
  delete process.env.AI_DAILY_PER_USER;
});

test('ai guard: the global circuit breaker stops everyone at the daily ceiling', async () => {
  resetGuard();
  process.env.AI_DAILY_GLOBAL = '2';
  await hit({ ip: 'p' }); await hit({ ip: 'q' });
  const r = await hit({ ip: 'r' });
  assert.strictEqual(r.status, 503);
  delete process.env.AI_DAILY_GLOBAL;
});

test('ai guard: counters reset at midnight Oman time', () => {
  resetGuard();
  guard._state.global = 99; guard._state.perKey.set('ip:x', 5);
  guard._rollover(Date.now() + 26 * 3600e3);
  assert.strictEqual(guard._state.global, 0);
  assert.strictEqual(guard._state.perKey.size, 0);
});

// ── controller: cache and grounding ─────────────────────────────────────────
const SupabaseDB = require('../src/models/SupabaseDB');
const ai = require('../src/services/ai');
let modelCalls = 0;
let nextJSON = null;
ai.enabled = true;
ai.complete = async () => { modelCalls++; return 'Travellers praise the deep knowledge.'; };
ai.completeJSON = async () => { modelCalls++; return nextJSON; };

const REVIEWS = [
  { reviewId: 'r1', guideId: 'g1', rating: 5, comment: 'Great', createdAt: '2026-09-01' },
  { reviewId: 'r2', guideId: 'g1', rating: 4, comment: 'Good', createdAt: '2026-09-02' },
  { reviewId: 'r3', guideId: 'g1', rating: 5, comment: 'Superb', createdAt: '2026-09-03' },
];
const GUIDES = [{ id: 'g1', fullName: 'Salim', userType: 'guide', isVerified: true, photo: '/p.jpg', pricePerDay: 40 }];
SupabaseDB.prototype.findAllWhere = async function (where) {
  if (this.table === 'reviews') return REVIEWS.filter(r => r.guideId === where.guideId);
  if (this.table === 'users') return GUIDES;
  return [];
};

const ctrl = require('../src/controllers/aiController');
const call = (handler, req) => new Promise(resolve => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); } };
  handler({ params: {}, query: {}, body: {}, session: {}, ...req }, res);
});

test('reviews summary: the model runs once, then the summary comes from cache', async () => {
  modelCalls = 0; ctrl._summaryCache.clear();
  const a = await call(ctrl.reviewsSummary, { params: { guideId: 'g1' }, query: { lang: 'en' } });
  const b = await call(ctrl.reviewsSummary, { params: { guideId: 'g1' }, query: { lang: 'en' } });
  assert.strictEqual(a.body.summary, b.body.summary);
  assert.strictEqual(b.body.cached, true);
  assert.strictEqual(modelCalls, 1, 'a repeat view must not call the model again');
});

test('reviews summary: a new review regenerates it', async () => {
  modelCalls = 0; ctrl._summaryCache.clear();
  await call(ctrl.reviewsSummary, { params: { guideId: 'g1' }, query: {} });
  REVIEWS.push({ reviewId: 'r4', guideId: 'g1', rating: 3, comment: 'Late', createdAt: '2026-09-04' });
  await call(ctrl.reviewsSummary, { params: { guideId: 'g1' }, query: {} });
  assert.strictEqual(modelCalls, 2);
  REVIEWS.pop();
});

test('match: a guide id the model invented is dropped; names come from the database', async () => {
  nextJSON = { matches: [
    { guideId: 'g1', guideName: 'Wrong Name', reason: 'fits', score: 90 },
    { guideId: 'ghost', guideName: 'Invented Guide', reason: 'made up', score: 80 },
  ] };
  const r = await call(ctrl.match, { body: { need: 'history tour in Nizwa' } });
  assert.strictEqual(r.body.matches.length, 1);
  assert.strictEqual(r.body.matches[0].guideName, 'Salim');
});

test('trip plan: an invented guide is removed from the day, a real one keeps its real name', async () => {
  nextJSON = { title: 't', summary: 's', totalEstimatedOMR: 80, tips: [], days: [
    { day: 1, theme: 'a', governorate: 'Ad Dakhiliyah', activities: [], suggestedGuideId: 'g1', suggestedGuideName: 'x', estimatedCostOMR: 40 },
    { day: 2, theme: 'b', governorate: 'Muscat', activities: [], suggestedGuideId: 'nobody', suggestedGuideName: 'Fake', estimatedCostOMR: 40 },
  ] };
  const r = await call(ctrl.tripPlan, { body: { request: 'two days' } });
  assert.strictEqual(r.body.plan.days[0].suggestedGuideName, 'Salim');
  assert.strictEqual(r.body.plan.days[1].suggestedGuideId, '');
  assert.strictEqual(r.body.plan.days[1].suggestedGuideName, '');
});

test('a model refusal becomes a friendly message, not a 500', async () => {
  const { AIError } = ai;
  ai.completeJSON = async () => { throw new AIError('AI_REFUSED'); };
  const r = await call(ctrl.match, { body: { need: 'x' } });
  assert.strictEqual(r.status, 422);
  assert.match(r.body.message, /rephras/);
});

test('ai service: the default model is the current Claude Opus', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'services', 'ai.js'), 'utf8');
  assert.match(src, /process\.env\.ANTHROPIC_MODEL \|\| 'claude-opus-5-5'/);
  assert.match(src, /stop_reason === 'refusal'/);
});
