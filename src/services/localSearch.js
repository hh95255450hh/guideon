/**
 * localSearch.js — understands common search requests without calling a model.
 *
 * Most visitors type short things like "مرشد في نزوى يتكلم إنجليزي" or
 * "desert trip for a family under 50 rials". Those map straight onto the search
 * filters with a dictionary of Oman's places, languages and trip types, at no
 * cost. The AI search (aiController.search) asks this first and only calls the
 * model for long or unusual requests — and falls back to this when the model is
 * unavailable, so the search box keeps working.
 *
 * Output has the same shape the model returns, so cleanFilters() validates both.
 */

// Arabic and English text folded to one comparable form.
function norm(s) {
  return ' ' + String(s || '')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')   // harakat, tatweel
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim() + ' ';
}

// Arabic prepositions/article glued to the front of a word: "بنزوى", "لمسقط", "والسيب".
const AR_PREFIX = '(?:و|ف|ب|ل|ك)?(?:ال)?';
function wordRe(term) {
  const t = norm(term).trim();
  if (!t) return null;
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Strip a leading Arabic article from the dictionary term so prefixes can vary.
  const core = /^ال/.test(esc) ? esc.slice(2) : esc;
  return /[؀-ۿ]/.test(t)
    ? new RegExp(` ${AR_PREFIX}${core} `)
    : new RegExp(` (?:al |ash |as |ad |an |ar |az )?${esc.replace(/^(?:al|ash|as|ad|an|ar|az) /, '')} `);
}

// Landmarks visitors name instead of the wilayat (kept in sync with the AI prompt).
const LANDMARKS = [
  [['jebel shams', 'jabal shams', 'جبل شمس'], 'Al Hamra'],
  [['wahiba', 'wahiba sands', 'sharqiya sands', 'رمال وهيبه', 'رمال الشرقيه', 'وهيبه'], 'Bidiyah'],
  [['ras al jinz', 'ras al hadd', 'turtle reserve', 'راس الجنز', 'راس الحد'], 'Sur'],
  [['jebel akhdar', 'jabal akhdar', 'green mountain', 'الجبل الاخضر'], 'Nizwa'],
  [['wadi shab', 'وادي شاب', 'wadi tiwi', 'وادي طيوي'], 'Sur'],
  [['wadi bani khalid', 'وادي بني خالد'], 'Wadi Bani Khalid'],
  [['mutrah', 'muttrah corniche', 'مطرح'], 'Muttrah'],
  [['khasab', 'خصب'], 'Khasab'],
  [['salalah', 'صلاله'], 'Salalah'],
];

const LANGUAGES = [
  ['English', ['english', 'انجليزي', 'انجليزيه', 'الانجليزيه', 'انكليزي', 'انقليزي']],
  ['Arabic', ['arabic', 'عربي', 'العربيه']],
  ['French', ['french', 'francais', 'فرنسي', 'الفرنسيه']],
  ['German', ['german', 'deutsch', 'الماني', 'الالمانيه']],
  ['Italian', ['italian', 'ايطالي', 'الايطاليه']],
  ['Spanish', ['spanish', 'espanol', 'اسباني', 'الاسبانيه']],
  ['Russian', ['russian', 'روسي', 'الروسيه']],
  ['Chinese', ['chinese', 'mandarin', 'صيني', 'الصينيه']],
  ['Hindi', ['hindi', 'هندي', 'الهنديه']],
  ['Urdu', ['urdu', 'اردو', 'الارديه']],
  ['Bengali', ['bengali', 'bangla', 'بنغالي']],
  ['Portuguese', ['portuguese', 'برتغالي']],
  ['Japanese', ['japanese', 'ياباني']],
  ['Korean', ['korean', 'كوري']],
  ['Turkish', ['turkish', 'تركي']],
  ['Persian', ['persian', 'farsi', 'فارسي']],
  ['Swahili', ['swahili', 'سواحيلي']],
  ['Dutch', ['dutch', 'هولندي']],
];

const LANG_AR = { English: 'الإنجليزية', Arabic: 'العربية', French: 'الفرنسية', German: 'الألمانية', Italian: 'الإيطالية', Spanish: 'الإسبانية', Russian: 'الروسية', Chinese: 'الصينية', Hindi: 'الهندية', Urdu: 'الأردية', Bengali: 'البنغالية', Portuguese: 'البرتغالية', Japanese: 'اليابانية', Korean: 'الكورية', Turkish: 'التركية', Persian: 'الفارسية', Swahili: 'السواحيلية', Dutch: 'الهولندية' };

const SPECS = [
  ['Historical', ['history', 'historical', 'fort', 'forts', 'castle', 'heritage', 'تاريخ', 'تاريخي', 'تاريخيه', 'قلعه', 'قلاع', 'حصن', 'حصون', 'تراث']],
  ['Cultural', ['culture', 'cultural', 'souq', 'souk', 'market', 'ثقافه', 'ثقافي', 'سوق', 'اسواق']],
  ['Desert', ['desert', 'dunes', 'sand', 'camping', 'camp', 'صحراء', 'صحراويه', 'كثبان', 'رمال', 'تخييم']],
  ['Mountain', ['mountain', 'mountains', 'hiking', 'hike', 'trek', 'trekking', 'جبل', 'جبال', 'جبليه', 'هايكنج', 'مشي']],
  ['Marine', ['sea', 'beach', 'diving', 'dive', 'snorkel', 'snorkeling', 'dolphin', 'dolphins', 'boat', 'بحر', 'بحريه', 'شاطي', 'شواطي', 'غوص', 'دلافين', 'قارب']],
  ['Wildlife', ['wildlife', 'turtle', 'turtles', 'bird', 'birds', 'سلاحف', 'سلحفاه', 'طيور', 'حياه بريه']],
  ['Adventure', ['adventure', 'canyon', 'canyoning', 'offroad', 'off road', 'climbing', 'مغامره', 'مغامرات', 'تسلق']],
];

const COMPANY = ['company', 'agency', 'operator', 'organised tour', 'organized tour', 'group tour', 'شركه', 'شركات', 'وكاله', 'مكتب سياحي'];
const CHEAP = ['cheap', 'cheapest', 'budget', 'affordable', 'رخيص', 'ارخص', 'اقتصادي'];
const TOP = ['top rated', 'best rated', 'highest rated', 'best guide', 'افضل', 'الافضل', 'اعلي تقييم', 'افضل تقييم'];
const TOMORROW = ['tomorrow', 'بكره', 'غدا', 'باكر'];
const TODAY = ['today', 'tonight', 'اليوم', 'الليله'];

const has = (text, terms) => terms.some(t => { const re = wordRe(t); return re && re.test(text); });

function parse(q, loc, today) {
  const text = norm(q);
  const out = {
    type: 'guide', governorate: '', destination: '', language: '', specialisation: '',
    date: '', participants: 0, maxPrice: 0, minRating: 0, sortBy: '',
  };
  const said = { ar: [], en: [] };
  let hits = 0;

  if (has(text, COMPANY)) { out.type = 'company'; hits++; }

  // Place: landmark → wilayat → governorate, most specific first.
  for (const [terms, wilayat] of LANDMARKS) {
    if (loc.wilayats.includes(wilayat) && has(text, terms)) { out.destination = wilayat; break; }
  }
  if (!out.destination) {
    // Longer names first, so "Wadi Bani Khalid" wins over a shorter overlap.
    const wl = loc.list.flatMap(g => g.wilayats).sort((a, b) => b.en.length - a.en.length);
    const w = wl.find(x => has(text, [x.en, x.ar]));
    if (w) out.destination = w.en;
  }
  if (out.destination) {
    const g = loc.list.find(x => x.wilayats.some(w => w.en === out.destination));
    const w = g && g.wilayats.find(x => x.en === out.destination);
    if (g) out.governorate = g.governorateEn;
    said.ar.push('في ' + (w ? w.ar : out.destination)); said.en.push('in ' + out.destination);
    hits++;
  } else {
    const g = loc.list.find(x => has(text, [x.governorateEn, x.governorateAr]));
    if (g) {
      out.governorate = g.governorateEn;
      said.ar.push('في ' + g.governorateAr); said.en.push('in ' + g.governorateEn);
      hits++;
    }
  }

  const lang = LANGUAGES.find(([, terms]) => has(text, terms));
  // "Arabic" alone is usually just the language they typed in, not a request.
  if (lang && !(lang[0] === 'Arabic' && !/(يتكلم|يتحدث|يجيد|speak|speaking|speaks)/.test(text))) {
    out.language = lang[0];
    said.ar.push('يتحدث ' + (LANG_AR[lang[0]] || lang[0])); said.en.push(lang[0] + '-speaking');
    hits++;
  }

  const spec = SPECS.find(([, terms]) => has(text, terms));
  if (spec) {
    out.specialisation = spec[0];
    said.en.push(spec[0].toLowerCase());
    said.ar.push({ Historical: 'تاريخ وتراث', Cultural: 'ثقافة', Desert: 'صحراء', Mountain: 'جبال', Marine: 'بحر', Wildlife: 'حياة برية', Adventure: 'مغامرات' }[spec[0]]);
    hits++;
  }

  const people = text.match(/ (\d{1,3}) (?:people|persons|pax|adults|travellers|travelers|اشخاص|شخص|افراد|فرد|نفر) /);
  if (people) { out.participants = +people[1]; hits++; }

  const price = text.match(/ (\d{1,5}) (?:omr|ro|rial|rials|riyal|ريال|ريالات|رع) /) || text.match(/ (?:omr|ro) (\d{1,5}) /);
  if (price) {
    out.maxPrice = +price[1];
    said.ar.push(`حتى ${price[1]} ر.ع`); said.en.push(`up to ${price[1]} OMR`);
    hits++;
  }

  if (has(text, TOP)) { out.minRating = 4.5; hits++; }
  if (has(text, CHEAP)) { out.sortBy = 'price_asc'; hits++; }

  const day = has(text, TOMORROW) ? 1 : has(text, TODAY) ? 0 : null;
  if (day != null) {
    const d = new Date(today + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + day);
    out.date = d.toISOString().slice(0, 10);
    hits++;
  }

  const who = out.type === 'company' ? ['شركة سياحية', 'Tourism company'] : ['مرشد', 'Guide'];
  out.summary_ar = [who[0], ...said.ar].join(' · ');
  out.summary_en = [who[1], ...said.en].join(' · ');
  out._hits = hits;
  out._words = text.trim().split(' ').filter(Boolean).length;
  return out;
}

// Good enough to skip the model: something concrete was understood and the
// request is short enough that little else can be hiding in it.
function confident(p) {
  return p._hits >= 1 && p._words <= 8;
}

module.exports = { parse, confident, norm };
