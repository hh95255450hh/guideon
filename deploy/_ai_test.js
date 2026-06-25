const Anthropic = require('@anthropic-ai/sdk');
const c = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
c.messages.create({
  model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
  max_tokens: 16,
  messages: [{ role: 'user', content: 'Reply with exactly: AI_WORKS' }],
}).then(r => console.log('RESULT:', r.content[0].text.trim()))
  .catch(e => console.log('ERROR:', e.status || '', e.message));
