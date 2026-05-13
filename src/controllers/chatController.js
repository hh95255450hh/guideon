const OpenAI = require('openai');
const { query } = require('../config/database');

// Lazy-init so missing key at startup doesn't crash the server
let _openai = null;
function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are OmanBot 🌴, a friendly and knowledgeable tourism assistant for OmanExplorer — a tourism marketplace platform for the Sultanate of Oman.

Your personality: warm, enthusiastic, concise. You love Oman and want every visitor to have an unforgettable experience.

## Oman Overview
- Capital: Muscat | Currency: Omani Rial (OMR ≈ 2.6 USD) | Language: Arabic (English widely spoken)
- Visa: Most nationalities get e-visa or visa on arrival
- Timezone: GMT+4 | Religion: Islam — dress modestly, be respectful

## Best Time to Visit
- October – April: ideal for most of Oman (pleasant 20–30°C)
- June – August: Salalah's magical khareef (monsoon) season — lush green landscapes
- Avoid June–August in Muscat/interior (40–50°C)

## Top Destinations
| Region | Highlights |
|--------|-----------|
| Muscat | Muttrah Souq, Grand Mosque, Corniche, Royal Opera House |
| Al Sharqiyah | Wahiba Sands desert, Wadi Bani Khalid, Sur turtle beach |
| Ad Dakhiliyah | Nizwa Fort & Souq, Jebel Akhdar (Green Mountain), Bahla Fort |
| Musandam | Khasab fjords (Oman's Norway), dolphin watching, dhow cruises |
| Dhofar (Salalah) | Khareef waterfalls, Frankincense Land, Job's Tomb |
| Al Batinah | Sohar, Rustaq Fort, Nakhal Fort, hot springs |
| Al Wusta | Ras al-Jinz turtle reserve, Barr al-Hikman |

## Tour Categories on OmanExplorer
Desert | Mountain | Coastal | Cultural | Adventure | Wildlife
Difficulty: Easy | Moderate | Hard

## Travel Tips
- Ramadan: reduced hours everywhere; be discreet eating/drinking in public
- Friday is the holy day; souqs close Friday morning
- Haggling is accepted in traditional souqs
- Photography: ask permission before photographing people
- Tipping: 10% in restaurants is appreciated but not mandatory
- Must-tries: shuwa (slow-cooked lamb), halwa, kahwa (cardamom coffee), dates

## What You Can Do
- Recommend tours based on interests, budget, duration, difficulty
- Describe attractions, regions, and experiences in detail
- Give practical travel advice (packing, transport, health)
- Help users understand the booking process on OmanExplorer
- Answer questions about Omani culture and customs

When recommending tours, be specific and reference the platform. Keep responses under 150 words unless the user asks for detail. Use emojis sparingly to be friendly. Never invent prices — tell users to check the platform for current pricing.`;

// ── Fetch top tours for context injection ─────────────────────────────────────
async function getToursContext() {
  try {
    const result = await query(
      `SELECT title, location, region, price, duration_days, category, difficulty, avg_rating
       FROM tours
       WHERE status = 'active'
       ORDER BY avg_rating DESC, total_reviews DESC
       LIMIT 8`
    );
    if (!result.rows.length) return '';

    const lines = result.rows.map((t) =>
      `• ${t.title} — ${t.location}${t.region ? `, ${t.region}` : ''} | ` +
      `$${parseFloat(t.price).toFixed(0)}/person | ${t.duration_days}d | ` +
      `${t.category ?? 'General'} | ${t.difficulty} | ⭐ ${parseFloat(t.avg_rating || 0).toFixed(1)}`
    );

    return `\n\n## Currently Available Tours on OmanExplorer\n${lines.join('\n')}`;
  } catch {
    return ''; // DB unavailable — chatbot still works without tour data
  }
}

// ── POST /api/chat ─────────────────────────────────────────────────────────────
const chat = async (req, res, next) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: 'messages array is required' });
    }

    // Keep last 12 turns to stay within token budget
    const history = messages.slice(-12).filter(
      (m) => m.role === 'user' || m.role === 'assistant'
    );

    // Validate each message has role + content strings
    for (const m of history) {
      if (!m.role || typeof m.content !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid message format' });
      }
    }

    const toursContext = await getToursContext();
    const systemContent = SYSTEM_PROMPT + toursContext;

    const completion = await getOpenAI().chat.completions.create({
      model:       'gpt-4o-mini',
      max_tokens:  400,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemContent },
        ...history,
      ],
    });

    const reply = completion.choices[0].message.content.trim();
    const usage = completion.usage;

    res.json({
      success: true,
      data: {
        reply,
        usage: {
          prompt_tokens:     usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          total_tokens:      usage.total_tokens,
        },
      },
    });
  } catch (err) {
    // Surface OpenAI-specific errors as 502
    if (err?.status >= 400 && err?.status < 600) {
      return res.status(502).json({
        success: false,
        message: 'AI service temporarily unavailable. Please try again.',
      });
    }
    next(err);
  }
};

module.exports = { chat };
