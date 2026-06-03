const OpenAI = require('openai');
const { getPlatformContext } = require('../services/platformContext');

// Lazy-init so a missing key at startup doesn't crash the server
let _openai = null;

// ── AI provider resolution ────────────────────────────────────────────────────
// The bot works with any OpenAI-compatible provider. It auto-detects, in order:
//   1) Groq      (GROQ_API_KEY)      — free & fast, https://api.groq.com/openai/v1
//   2) OpenRouter(OPENROUTER_API_KEY)— https://openrouter.ai/api/v1
//   3) OpenAI    (OPENAI_API_KEY)    — default https://api.openai.com/v1
// Override the model per-provider with *_MODEL env vars.
function resolveProvider() {
  const valid = (k) => k && !k.includes('REPLACE');
  if (valid(process.env.GROQ_API_KEY)) {
    return { key: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1',
             model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', name: 'groq' };
  }
  if (valid(process.env.OPENROUTER_API_KEY)) {
    return { key: process.env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1',
             model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free', name: 'openrouter' };
  }
  if (valid(process.env.OPENAI_API_KEY) && process.env.OPENAI_API_KEY.startsWith('sk-')) {
    return { key: process.env.OPENAI_API_KEY, baseURL: undefined,
             model: process.env.OPENAI_MODEL || 'gpt-4o-mini', name: 'openai' };
  }
  return null;
}

function isApiKeyConfigured() {
  return !!resolveProvider();
}

function getOpenAI() {
  if (!_openai) {
    const p = resolveProvider();
    if (!p) throw new Error('No AI provider configured (set GROQ_API_KEY, OPENROUTER_API_KEY or OPENAI_API_KEY)');
    _openai = new OpenAI({ apiKey: p.key, baseURL: p.baseURL });
  }
  return _openai;
}

function aiModel() {
  return (resolveProvider() || {}).model || 'gpt-4o-mini';
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are GuideonBot 🌴, a friendly and knowledgeable tourism assistant for Guideon — a tourism marketplace platform for the Sultanate of Oman.

Your personality: warm, enthusiastic, concise. You love Oman and want every visitor to have an unforgettable experience.

IMPORTANT LANGUAGE RULE: Always respond in the same language the user writes in. If they write in Arabic, respond entirely in Arabic. If they write in English, respond in English. Never mix languages unless the user does so first.

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

## Tour Categories on Guideon
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
- Recommend tours and guides based on interests, budget, duration, difficulty
- Describe attractions, regions, and experiences in detail
- Give practical travel advice (visa, packing, transport, SIM/internet, money, safety, family travel, health)
- Help users understand and complete the booking process on Guideon
- Answer questions about Omani culture, customs, food, history and language
- Answer general travel and trip-planning questions, building itineraries day-by-day

## How booking works on Guideon (explain when asked)
1. Browse guides ("Find a Guide") or tours, filter by region, language, date and budget.
2. Open a guide/tour, pick a date and number of travelers (cannot exceed the guide's max group size).
3. Confirm the booking — the guide accepts, then on the day starts the tour and marks it complete.
4. After the tour, leave a verified review. Support: hh92hh@guideon.om · Instagram @guideonoman.

## Answering style
- Be genuinely helpful and try to answer EVERY question. Only decline content that is unsafe or unrelated to helping a traveler.
- If a question is outside Oman tourism (e.g. general knowledge), still give a brief helpful answer, then gently steer back to planning their Oman trip.
- Prefer recommending REAL guides/tours from the live platform data below when present.
- Keep responses concise (under ~160 words) unless asked for detail. Use emojis sparingly.
- Never invent exact prices beyond what the live data shows — point users to the platform for current pricing and availability.`;

// ── Local knowledge-base fallback (used when OpenAI key is not configured) ──
// Each entry has: en (English regex patterns), ar (Arabic keyword strings), and responses
const LOCAL_KB = [
  {
    en: /hello|hi\b|hey\b|ahlan|greet/i,
    ar: ['مرح', 'السلام', 'أهل', 'أهلاً'],
    reply_en: "Hello! 👋 I'm **GuideonBot**, your AI guide to Oman. Ask me about destinations, tours, travel tips, or booking guides on Guideon! 🌿",
    reply_ar: "مرحباً! 👋 أنا **GuideonBot**، مساعدك السياحي الذكي لعُمان. اسألني عن الوجهات السياحية، الجولات، نصائح السفر، أو حجز مرشد على Guideon! 🌿"
  },
  {
    en: /muscat/i,
    ar: ['مسقط'],
    reply_en: "Muscat is Oman's stunning capital! 🕌 Must-see: **Muttrah Souq**, Sultan Qaboos Grand Mosque, the Corniche, and Royal Opera House. Best visited Oct–Apr. Browse Muscat guides on Guideon!",
    reply_ar: "مسقط هي العاصمة الرائعة لعُمان! 🕌 أبرز المعالم: **سوق مطرح**، مسجد السلطان قابوس الأكبر، الكورنيش، ودار الأوبرا السلطانية. تصفح مرشدي مسقط على Guideon!"
  },
  {
    en: /salalah|dhofar|kharee/i,
    ar: ['صلالة', 'ظفار', 'خريف'],
    reply_en: "Salalah & Dhofar are magical! 🌿 The **khareef** (monsoon, Jun–Aug) turns it lush green — waterfalls, mist, and frankincense trees. Also visit Job's Tomb and Al Mughsail beach.",
    reply_ar: "صلالة وظفار رائعتان! 🌿 **موسم الخريف** (يونيو–أغسطس) يحوّلهما إلى مناطق خضراء ساحرة بالشلالات والضباب وأشجار اللبان."
  },
  {
    en: /nizwa|jebel akhdar|green mountain/i,
    ar: ['نزوى', 'جبل الأخضر'],
    reply_en: "Nizwa is Oman's cultural heart! 🏰 Visit **Nizwa Fort**, the ancient souq (famous for silver), and the Jebel Akhdar (Green Mountain) rose gardens. Perfect for history lovers!",
    reply_ar: "نزوى هي عاصمة الثقافة العُمانية! 🏰 قم بزيارة **قلعة نزوى**، السوق القديمة (الشهيرة بالفضة)، وحدائق ورود جبل الأخضر."
  },
  {
    en: /desert|wahiba|safari|dune/i,
    ar: ['صحراء', 'رمال', 'الوهيبة', 'سفاري'],
    reply_en: "Wahiba Sands is Oman's iconic desert! 🐪 Golden dunes, camel rides, and magical starry nights. Our desert guides offer full-day & overnight trips. Perfect for adventure seekers!",
    reply_ar: "رمال الوهيبة هي الصحراء الأيقونية في عُمان! 🐪 كثبان ذهبية، ركوب الإبل، وليالٍ مرصّعة بالنجوم. مرشدونا يقدمون جولات نهارية وليلية."
  },
  {
    en: /musandam|khasab|fjord|dolphin/i,
    ar: ['مسندم', 'خصب', 'دلفين'],
    reply_en: "Musandam is Oman's hidden gem! 🏔️ Known as 'Norway of Arabia' for its stunning fjords. Don't miss dolphin watching, dhow cruises, and snorkelling in Khasab.",
    reply_ar: "مسندم هي الجوهرة الخفية في عُمان! 🏔️ تُعرف بـ'النرويج العربية' لخوراتها الخلابة. لا تفوت مشاهدة الدلافين والرحلات بالسنبوك."
  },
  {
    en: /price|cost|budget|cheap|OMR/i,
    ar: ['سعر', 'تكلفة', 'ميزانية', 'ريال'],
    reply_en: "Guide prices on Guideon start from **40 OMR/day** (≈104 USD). Filter guides by budget on our search page. Best value: 3–5 day packages with local guides! 💰",
    reply_ar: "أسعار المرشدين على Guideon تبدأ من **40 ريالاً عمانياً/يوم** (≈104 دولاراً). صفّ المرشدين حسب الميزانية. أفضل قيمة: باقات 3-5 أيام! 💰"
  },
  {
    en: /book|reserve|appointment/i,
    ar: ['حجز', 'احجز', 'موعد'],
    reply_en: "Booking a guide is easy! 📅\n1. Browse guides → **Find a Guide**\n2. Check availability calendar\n3. Select dates & confirm\nYou'll be confirmed within 24 hours!",
    reply_ar: "حجز مرشد سهل جداً! 📅\n1. تصفح المرشدين ← **ابحث عن مرشد**\n2. تحقق من التقويم\n3. اختر التواريخ وأكّد\nستتلقى تأكيداً خلال 24 ساعة!"
  },
  {
    en: /when|best time|weather|season/i,
    ar: ['متى', 'أفضل وقت', 'طقس', 'فصل'],
    reply_en: "Best time to visit Oman 🗓️\n- **Oct–Apr**: Muscat & interior (20–30°C, perfect)\n- **Jun–Aug**: Salalah khareef season 🌿\n- Avoid interior in summer (can reach 50°C!)",
    reply_ar: "أفضل وقت لزيارة عُمان 🗓️\n- **أكتوبر–أبريل**: مسقط والداخلية (20-30°م، ممتاز)\n- **يونيو–أغسطس**: موسم خريف صلالة 🌿\n- تجنب الداخلية صيفاً (قد تصل لـ50°م!)"
  },
  {
    en: /food|eat|restaurant|shuwa|halwa|kahwa|cuisine/i,
    ar: ['طعام', 'أكل', 'مطعم', 'حلوى', 'قهوة'],
    reply_en: "Omani cuisine is delicious! 🍽️ Must-tries:\n- **Shuwa**: slow-cooked spiced lamb\n- **Halwa**: sweet Omani dessert\n- **Kahwa**: cardamom coffee with dates\n- **Majboos**: Omani spiced rice",
    reply_ar: "المأكولات العُمانية رائعة! 🍽️ لا بد من تجربة:\n- **الشواء**: لحم مطهو ببطء\n- **الحلوى العُمانية**: حلوى تقليدية\n- **القهوة العربية**: بالهيل مع التمر\n- **المجبوس**: أرز عُماني"
  },
  {
    en: /turtle|ras al.?jinz/i,
    ar: ['سلحفاة', 'رأس الجنز'],
    reply_en: "Ras al-Jinz is one of the world's most important sea turtle nesting sites! 🐢 Watch green turtles lay eggs or hatch — magical night tours available. Our guides know the best spots!",
    reply_ar: "رأس الجنز هو أحد أهم مواقع تعشيش السلاحف البحرية في العالم! 🐢 جولات ليلية سحرية متاحة."
  },
  {
    en: /visa|passport|entry|e-?visa/i,
    ar: ['تأشيرة', 'فيزا', 'جواز', 'دخول'],
    reply_en: "Entry to Oman 🛂 Most nationalities get an **e-visa** (apply online at evisa.rop.gov.om) or visa on arrival. A 10-day tourist e-visa is common; longer options exist. Passport valid 6+ months. Check your nationality's rules before travel.",
    reply_ar: "الدخول إلى عُمان 🛂 معظم الجنسيات تحصل على **تأشيرة إلكترونية** (عبر evisa.rop.gov.om) أو تأشيرة عند الوصول. التأشيرة السياحية لـ10 أيام شائعة. يجب أن يكون الجواز صالحاً 6 أشهر+. تحقق من قواعد جنسيتك قبل السفر."
  },
  {
    en: /sim|internet|data|wifi|esim|phone/i,
    ar: ['شريحة', 'انترنت', 'إنترنت', 'بيانات', 'واي فاي'],
    reply_en: "Staying connected 📱 Buy a local SIM from **Omantel** or **Ooredoo** at the airport or malls (passport needed). Tourist data bundles are cheap. eSIMs also work. WiFi is common in hotels & cafés.",
    reply_ar: "البقاء على اتصال 📱 اشترِ شريحة محلية من **عمانتل** أو **أوريدو** من المطار أو المولات (تحتاج جواز السفر). باقات بيانات السياح رخيصة. شرائح eSIM تعمل أيضاً. الواي فاي متوفر في الفنادق والمقاهي."
  },
  {
    en: /transport|car|rent|drive|taxi|getting around|airport/i,
    ar: ['نقل', 'سيارة', 'تأجير', 'قيادة', 'تاكسي', 'مطار', 'مواصلات'],
    reply_en: "Getting around Oman 🚗 **Renting a car** is the best way to explore (roads are excellent; a 4x4 for desert/wadis). Taxis & apps work in cities. Or book a **Guideon guide with a vehicle** for a stress-free trip!",
    reply_ar: "التنقل في عُمان 🚗 **استئجار سيارة** هو أفضل طريقة للاستكشاف (الطرق ممتازة؛ ودفع رباعي للصحراء والوديان). التاكسي والتطبيقات متاحة في المدن. أو احجز **مرشداً مع سيارة على Guideon** لرحلة مريحة!"
  },
  {
    en: /safe|safety|danger|crime|solo|woman|alone/i,
    ar: ['آمن', 'أمان', 'خطر', 'بمفرد', 'لوحد', 'امرأة'],
    reply_en: "Is Oman safe? ✅ Yes — Oman is one of the **safest countries** in the world, very welcoming, with low crime. Great for solo and family travel. Just dress modestly, respect customs, and carry water in remote areas.",
    reply_ar: "هل عُمان آمنة؟ ✅ نعم — عُمان من **أكثر دول العالم أماناً**، شعبها مرحّب ومعدل الجريمة منخفض. ممتازة للسفر الفردي والعائلي. فقط احترم العادات والبس بحشمة واحمل الماء في المناطق النائية."
  },
  {
    en: /family|kid|child|baby|honeymoon|couple/i,
    ar: ['عائلة', 'أطفال', 'طفل', 'عائلي', 'شهر العسل', 'عوائل'],
    reply_en: "Oman is fantastic for families & couples! 👨‍👩‍👧 Gentle options: dolphin watching, turtle reserves, wadis, beaches and forts. Many guides offer family-friendly, easy-difficulty tours. Filter by 'Easy' on Guideon.",
    reply_ar: "عُمان رائعة للعائلات والأزواج! 👨‍👩‍👧 خيارات مناسبة: مشاهدة الدلافين، محميات السلاحف، الوديان، الشواطئ والقلاع. كثير من المرشدين يقدمون جولات عائلية سهلة. صفِّ حسب 'سهل' على Guideon."
  },
  {
    en: /wadi|wadis|swim|pool|water/i,
    ar: ['وادي', 'وديان', 'سباحة', 'مسبح'],
    reply_en: "Oman's wadis are stunning! 💧 Top picks: **Wadi Shab** (hike + swim to a hidden cave), **Wadi Bani Khalid**, **Wadi Tiwi**. Bring water shoes. Our coastal & adventure guides run wadi trips.",
    reply_ar: "وديان عُمان خلابة! 💧 أفضلها: **وادي شاب** (مشي + سباحة لكهف مخفي)، **وادي بني خالد**، **وادي تيوي**. أحضر حذاء ماء. مرشدو المغامرة والساحل ينظمون جولات الوديان."
  },
  {
    en: /diving|snorkel|scuba|marine|reef|sea|beach/i,
    ar: ['غوص', 'سنوركل', 'بحر', 'شعاب', 'شاطئ', 'بحرية'],
    reply_en: "Marine adventures 🐠 Oman has rich waters — **Daymaniyat Islands** (snorkel/dive), Musandam fjords, and Bandar Khayran. Expect turtles, rays and colourful reefs. Book a coastal guide on Guideon!",
    reply_ar: "المغامرات البحرية 🐠 مياه عُمان غنية — **جزر الديمانيات** (سنوركل/غوص)، خوران مسندم، وبندر الخيران. ستشاهد السلاحف والشعاب الملونة. احجز مرشداً ساحلياً على Guideon!"
  },
  {
    en: /itinerary|days|plan|week|trip plan|schedule/i,
    ar: ['برنامج', 'خطة', 'جدول', 'أيام', 'رحلة'],
    reply_en: "Sample 5-day Oman trip 🗺️\n**Day 1-2:** Muscat (mosque, Muttrah, opera)\n**Day 3:** Nizwa fort & souq → Jebel Akhdar\n**Day 4:** Wahiba Sands desert + Wadi Bani Khalid\n**Day 5:** Sur & Ras al-Jinz turtles\nA Guideon guide can build & run this for you!",
    reply_ar: "برنامج 5 أيام في عُمان 🗺️\n**يوم 1-2:** مسقط (المسجد، مطرح، الأوبرا)\n**يوم 3:** قلعة نزوى والسوق ← جبل الأخضر\n**يوم 4:** صحراء الوهيبة + وادي بني خالد\n**يوم 5:** صور ورأس الجنز للسلاحف\nمرشد Guideon يمكنه إعداد وتنفيذ هذا لك!"
  },
  {
    en: /become a guide|register|join|work|sign up|how to be/i,
    ar: ['أصبح مرشد', 'تسجيل', 'انضمام', 'عمل', 'كيف أكون مرشد'],
    reply_en: "Want to become a guide? 🧭 Sign up on Guideon as a guide, complete your profile (licence, languages, regions, photos), and once verified you can publish tours and accept bookings. Go to the Register page to start!",
    reply_ar: "تريد أن تصبح مرشداً؟ 🧭 سجّل على Guideon كمرشد، أكمل ملفك (الترخيص، اللغات، المناطق، الصور)، وبعد التوثيق يمكنك نشر الرحلات وقبول الحجوزات. اذهب لصفحة التسجيل للبدء!"
  },
  {
    en: /contact|support|help|email|whatsapp|reach/i,
    ar: ['تواصل', 'دعم', 'مساعدة', 'ايميل', 'إيميل', 'واتساب'],
    reply_en: "Need help? 💬 Reach the Guideon team at **hh92hh@guideon.om** or via Instagram **@guideonoman**. For booking issues, use the in-app chat with your guide or the support inbox.",
    reply_ar: "تحتاج مساعدة؟ 💬 تواصل مع فريق Guideon عبر **hh92hh@guideon.om** أو إنستغرام **@guideonoman**. لمشاكل الحجز، استخدم المحادثة داخل التطبيق مع مرشدك أو صندوق الدعم."
  },
  {
    en: /best|top|recommend|destination|place/i,
    ar: ['أفضل', 'وجهة', 'مكان', 'أين'],
    reply_en: "Oman's top destinations 🇴🇲\n1. **Muscat** — capital, culture & coast\n2. **Nizwa** — ancient forts & souqs\n3. **Wahiba Sands** — epic desert\n4. **Salalah** — lush khareef season\n5. **Musandam** — dramatic fjords\n\nBrowse our guides for each region on Guideon!",
    reply_ar: "أفضل وجهات عُمان 🇴🇲\n1. **مسقط** — العاصمة، الثقافة والساحل\n2. **نزوى** — القلاع القديمة والأسواق\n3. **رمال الوهيبة** — تجربة صحراوية رائعة\n4. **صلالة** — موسم الخريف الخضراء\n5. **مسندم** — الخوران الخلابة\n\nتصفح مرشدينا لكل منطقة على Guideon!"
  },
];

// Detect Arabic by checking character codes (avoids regex encoding issues)
function isArabicText(text) {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0x0600 && c <= 0x06FF) return true;
  }
  return false;
}

function localReply(messages) {
  const last = messages[messages.length - 1]?.content || '';
  const arabic = isArabicText(last);
  const lower = last.toLowerCase();

  for (const entry of LOCAL_KB) {
    // Match English patterns OR Arabic keyword strings
    const matched = entry.en.test(lower) ||
      (arabic && entry.ar.some(kw => last.includes(kw)));
    if (matched) {
      return arabic ? entry.reply_ar : entry.reply_en;
    }
  }

  return arabic
    ? 'عذراً، لم أفهم سؤالك تماماً. 😊 اسألني عن وجهات عُمان، أفضل أوقات الزيارة، أسعار المرشدين، الحجز، أو نصائح السفر. 🌿'
    : "I didn't quite get that. 😊 Try asking about Oman's top destinations, best time to visit, guide prices, tour booking, or travel tips! 🌿";
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

    // Use local knowledge-base when OpenAI key is not configured
    if (!isApiKeyConfigured()) {
      const reply = localReply(history);
      return res.json({ success: true, data: { reply, usage: null } });
    }

    const liveData = await getPlatformContext();
    const completion = await getOpenAI().chat.completions.create({
      model:       aiModel(),
      max_tokens:  500,
      temperature: 0.7,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + (liveData ? '\n\n' + liveData : '') },
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

// ── POST /api/chat/stream — streams the reply token-by-token (plain text) ──────
const chatStream = async (req, res) => {
  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, message: 'messages array is required' });
  }
  const history = messages.slice(-12).filter(m => m.role === 'user' || m.role === 'assistant');
  for (const m of history) {
    if (!m.role || typeof m.content !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid message format' });
    }
  }

  // Plain-text streaming. no-transform prevents the compression middleware
  // from buffering, so chunks reach the browser immediately.
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  });

  // No API key → stream the local knowledge-base answer in small slices.
  if (!isApiKeyConfigured()) {
    const reply = localReply(history);
    const words = reply.split(/(\s+)/);
    let i = 0;
    const tick = setInterval(() => {
      if (i >= words.length) { clearInterval(tick); return res.end(); }
      res.write(words[i++]);
    }, 18);
    req.on('close', () => clearInterval(tick));
    return;
  }

  try {
    const liveData = await getPlatformContext();
    const stream = await getOpenAI().chat.completions.create({
      model: aiModel(),
      max_tokens: 500,
      temperature: 0.7,
      stream: true,
      messages: [{ role: 'system', content: SYSTEM_PROMPT + (liveData ? '\n\n' + liveData : '') }, ...history],
    });
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || '';
      if (delta) res.write(delta);
    }
    res.end();
  } catch (err) {
    // If nothing was sent yet, fall back to the local reply so the user still
    // gets an answer instead of an error.
    if (!res.writableEnded) {
      try { res.write(localReply(history)); } catch {}
      res.end();
    }
  }
};

module.exports = { chat, chatStream };
