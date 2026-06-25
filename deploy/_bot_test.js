const OpenAI = require('openai');
(async () => {
  const client = new OpenAI({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: 'https://api.anthropic.com/v1' });
  for (const model of ['claude-opus-4-8', 'claude-haiku-4-5']) {
    try {
      const r = await client.chat.completions.create({
        model, max_tokens: 60, temperature: 0.7,
        messages: [
          { role: 'system', content: 'You are GuideonBot, a concise Oman tourism assistant. Reply in the user language.' },
          { role: 'user', content: 'ما أفضل وقت لزيارة صلالة؟ بإيجاز.' },
        ],
      });
      console.log(`[${model}] OK ->`, r.choices[0].message.content.trim().slice(0, 120));
    } catch (e) { console.log(`[${model}] ERR`, e.status || '', (e.message||'').slice(0,120)); }
  }
  // streaming test (opus)
  try {
    process.stdout.write('[stream] ');
    const s = await client.chat.completions.create({ model: 'claude-opus-4-8', max_tokens: 40, stream: true,
      messages: [{ role:'user', content:'Say hello in 5 words.' }] });
    for await (const c of s) { const d = c.choices?.[0]?.delta?.content || ''; if (d) process.stdout.write(d); }
    console.log('  <- stream OK');
  } catch (e) { console.log('[stream] ERR', e.status||'', e.message); }
})();
