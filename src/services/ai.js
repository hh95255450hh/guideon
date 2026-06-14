/**
 * ai.js — shared Claude (Anthropic) client for all of Guideon's AI features.
 *
 * One place to construct the client, pick the model, and expose small helpers
 * so controllers don't each re-implement request plumbing. Powered by the
 * official Anthropic SDK with Claude Opus 4.8 + adaptive thinking.
 *
 * Requires the ANTHROPIC_API_KEY env var. If it's missing we expose
 * `enabled = false` so callers can degrade gracefully (the platform must keep
 * working without AI) instead of throwing on boot.
 */
const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
const enabled = !!process.env.ANTHROPIC_API_KEY;

let client = null;
if (enabled) {
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * Plain text completion. `effort` tunes thinking depth/spend (low|medium|high).
 * Returns the concatenated text of the response.
 */
async function complete({ system, messages, maxTokens = 2048, effort = 'medium' }) {
  if (!enabled) throw new Error('AI_DISABLED');
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    output_config: { effort },
    ...(system ? { system } : {}),
    messages,
  });
  return res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

/**
 * Structured JSON completion — constrains Claude to a JSON schema so the
 * result parses reliably. Returns the parsed object.
 */
async function completeJSON({ system, messages, schema, maxTokens = 4096, effort = 'medium' }) {
  if (!enabled) throw new Error('AI_DISABLED');
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    output_config: { effort, format: { type: 'json_schema', schema } },
    ...(system ? { system } : {}),
    messages,
  });
  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return JSON.parse(text);
}

module.exports = { enabled, MODEL, complete, completeJSON, client };
