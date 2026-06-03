/**
 * Live platform context for GuideonBot.
 * Builds a compact, token-efficient snapshot of REAL guides and tours so the
 * AI can recommend actual options (with names, regions, prices) instead of
 * generic advice. Cached in memory and refreshed periodically.
 */
const SupabaseDB = require('../models/SupabaseDB');

const users    = new SupabaseDB('users');
const packages = new SupabaseDB('tour_packages');

let _cache = { text: '', at: 0 };
const TTL = 5 * 60 * 1000; // 5 minutes

async function buildContext() {
  try {
    // Verified, available guides
    let guides = await users.findAllByField('userType', 'guide');
    guides = (guides || [])
      .filter(g => g.isVerified)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 18);

    // Published tours
    let tours = await packages.findAllByField('isPublished', true);
    tours = (tours || []).slice(0, 18);

    const gLines = guides.map(g => {
      const langs = Array.isArray(g.languages) ? g.languages.join('/') : '';
      const dest  = Array.isArray(g.destinations) ? g.destinations.join(', ') : '';
      const spec  = Array.isArray(g.specialisations) ? g.specialisations.slice(0, 3).join(', ') : '';
      const price = g.pricePerDay ? `${g.pricePerDay} OMR/day` : 'price on platform';
      const rating= g.rating ? `★${g.rating}` : 'new';
      return `- ${g.fullName} | ${dest || 'Oman'} | langs: ${langs || 'AR/EN'} | ${spec || 'general'} | ${price} | ${rating}`;
    });

    const tLines = tours.map(t => {
      const price = t.price_adult ? `${t.price_adult} OMR` : 'see platform';
      const region= t.destination || t.region || 'Oman';
      const dur   = t.duration || '';
      return `- "${t.title}" | ${region} | ${dur} | from ${price} | by ${t.providerName || 'a local guide'}`;
    });

    const text =
`## LIVE PLATFORM DATA (real, current — prefer recommending these)
### Available verified guides (${guides.length}):
${gLines.join('\n') || '- (none listed yet — invite the user to browse "Find a Guide")'}

### Published tours (${tours.length}):
${tLines.join('\n') || '- (none listed yet)'}

When a user asks for a guide or tour, recommend specific names/titles from the lists above and tell them to open the platform to view the profile, availability and exact price. If nothing matches, suggest the closest option and the search page (/search.html).`;

    _cache = { text, at: Date.now() };
    return text;
  } catch (e) {
    // Never break the chat because of context building
    return _cache.text || '';
  }
}

async function getPlatformContext() {
  if (Date.now() - _cache.at < TTL && _cache.text) return _cache.text;
  return buildContext();
}

module.exports = { getPlatformContext };
