/**
 * ai.js — shared Claude (Anthropic) client for all of Guideon's AI features.
 *
 * One place to construct the client, pick the model, and expose small helpers
 * so controllers don't each re-implement request plumbing. Uses the official
 * Anthropic SDK with Claude Opus 5.5 and adaptive thinking.
 *
 * Requires the ANTHROPIC_API_KEY env var. If it's missing we expose
 * `enabled = false` so callers can degrade gracefully (the platform must keep
 * working without AI) instead of throwing on boot.
 */
const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';

// Each feature runs on the cheapest model that does it well. The trip planner
// reasons over the whole guide roster and keeps the top model; bios and
// matchmaking use Sonnet; turning a search into filters and summarising reviews
// are small, structured jobs for Haiku (about 1/40 of Opus per token).
// Every tier can be overridden from the environment.
const MODELS = {
  best: MODEL,
  standard: process.env.ANTHROPIC_MODEL_STANDARD || 'claude-sonnet-5-5',
  fast: process.env.ANTHROPIC_MODEL_FAST || 'claude-haiku-5-5',
};
const enabled = !!process.env.ANTHROPIC_API_KEY;

let client = null;
if (enabled) {
  client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    // A visitor is waiting on every one of these calls; fail in a minute rather
    // than the SDK's default ten, and let the SDK retry 429/5xx/connection errors.
    timeout: 60_000,
    maxRetries: 2,
  });
}

// Typed failures the controllers turn into friendly bilingual messages.
class AIError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

// Server-side fallback: if the model's safety classifiers decline a request,
// the API re-runs it on Anthropic's recommended model for that refusal
// category inside the same call, instead of returning the refusal to us.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };

async function create({ tier = 'best', ...params }) {
  if (!enabled) throw new AIError('AI_DISABLED');
  const model = MODELS[tier] || MODEL;
  // Haiku has no server-side refusal fallback; sending the parameter is a 400.
  const fallback = /haiku/.test(model) ? {} : FALLBACK;
  const res = await client.beta.messages.create({ model, ...fallback, ...params });
  // Check why the model stopped before reading the content: a refusal (from the
  // whole fallback chain) carries no usable answer, and a max_tokens stop means
  // a structured answer was cut off mid-JSON.
  if (res.stop_reason === 'refusal') throw new AIError('AI_REFUSED');
  if (res.stop_reason === 'max_tokens') throw new AIError('AI_TRUNCATED');
  return res;
}

const textOf = res => res.content.filter(b => b.type === 'text').map(b => b.text).join('');

/**
 * Plain text completion. `effort` tunes thinking depth/spend (low|medium|high).
 * Claude Opus 5.5 defaults to medium effort, so it is always passed explicitly.
 */
async function complete({ system, messages, maxTokens = 2048, effort = 'medium', tier }) {
  const res = await create({
    tier,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    output_config: { effort },
    ...(system ? { system } : {}),
    messages,
  });
  return textOf(res).trim();
}

/**
 * Structured JSON completion — constrains Claude to a JSON schema so the
 * result parses reliably. Returns the parsed object.
 */
async function completeJSON({ system, messages, schema, maxTokens = 4096, effort = 'medium', tier }) {
  const res = await create({
    tier,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    output_config: { effort, format: { type: 'json_schema', schema } },
    ...(system ? { system } : {}),
    messages,
  });
  return JSON.parse(textOf(res));
}

module.exports = { enabled, MODEL, MODELS, complete, completeJSON, client, AIError };
