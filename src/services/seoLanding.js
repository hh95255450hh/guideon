/**
 * Programmatic SEO landing pages.
 *
 * The cold-start problem for a marketplace is discovery: a tourist Googling
 * "tour guide nizwa" — or "مرشد سياحي في نزوى" — should land on Guideon, not on
 * TripAdvisor. We already hold the data (verified guides and companies plus
 * their destinations and specialisations), so we generate one indexable,
 * server-rendered landing page per place and per category, in BOTH languages.
 *
 * Routes (see routes/seoLanding.js):
 *   /tour-guides/:place          ·  /ar/tour-guides/:place
 *   /tours/:category             ·  /ar/tours/:category
 *   /tour-companies              ·  /ar/tour-companies
 *   /tour-companies/:place       ·  /ar/tour-companies/:place
 *
 * MATCHING IS BILINGUAL ON PURPOSE. Providers type their destinations and
 * specialisations as free text, and roughly half write Arabic ("نزوى",
 * "المواقع التاريخية"). Matching English aliases alone silently hid them from
 * their own landing page — six Nizwa guides were invisible that way. Every
 * place and category therefore carries Arabic aliases too, and both sides are
 * normalised (diacritics stripped, أإآ→ا, ى→ي, ة→ه) so "الجبل الاخضر" matches
 * "الجبل الأخضر".
 *
 * These slugs never collide with the existing *.html files.
 */

// ── Arabic-aware normalisation ──
// Lowercase, strip tashkeel/tatweel, and fold the letter variants people spell
// inconsistently, so free-text profile data matches a canonical alias.
function norm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')  // tashkeel + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Place catalogue ──
// slug → bilingual name + blurb, the governorate it sits in, and the wilayat
// aliases (both languages) we match against a provider's destinations.
const PLACES = [
  { slug: 'muscat', en: 'Muscat', ar: 'مسقط', gov: 'Muscat', govAr: 'مسقط',
    aliases: ['Muscat','Muttrah','Mutrah','Bawshar','As Seeb','Seeb','Al Amerat','Qurayyat'],
    aliasesAr: ['مسقط','مطرح','بوشر','السيب','العامرات','قريات'],
    blurb: 'the capital — grand mosques, the Mutrah souq, forts and a corniche where heritage meets the sea.',
    blurbAr: 'العاصمة — الجوامع الكبرى وسوق مطرح والقلاع وكورنيش يلتقي فيه التراث بالبحر.' },
  { slug: 'nizwa', en: 'Nizwa', ar: 'نزوى', gov: 'Ad Dakhiliyah', govAr: 'الداخلية',
    aliases: ['Nizwa','Manah','Birkat Al Mouz','Al Aqr'],
    aliasesAr: ['نزوى','منح','بركة الموز','العقر'],
    blurb: 'the historic heart of Oman — its round fort, Friday goat market, and the old falaj-fed plantations.',
    blurbAr: 'قلب عُمان التاريخي — قلعتها المستديرة وسوق الجمعة وأفلاجها ومزارعها العريقة.' },
  { slug: 'bahla', en: 'Bahla', ar: 'بهلاء', gov: 'Ad Dakhiliyah', govAr: 'الداخلية',
    aliases: ['Bahla','Jabrin','Jabreen'],
    aliasesAr: ['بهلاء','بهلا','جبرين','حصن جبرين'],
    blurb: 'home to Oman\'s first UNESCO World Heritage site — a vast mud-brick fort, an oasis wall and a living pottery tradition.',
    blurbAr: 'موطن أول موقع عُماني في قائمة التراث العالمي — قلعة طينية شاسعة وسور الواحة وصناعة الفخار العريقة.' },
  { slug: 'jabal-shams', en: 'Jabal Shams', ar: 'جبل شمس', gov: 'Ad Dakhiliyah', govAr: 'الداخلية',
    aliases: ['Jabal Shams','Jebel Shams','Grand Canyon of Oman','Wadi Ghul'],
    aliasesAr: ['جبل شمس','وادي غول','الأخدود'],
    blurb: 'Oman\'s highest peak and the rim of its Grand Canyon — the Balcony Walk, abandoned cliff villages and cool mountain air.',
    blurbAr: 'أعلى قمة في عُمان وحافة أخدودها العظيم — ممشى الشرفة والقرى المهجورة على الجرف وهواء الجبل البارد.' },
  { slug: 'al-hamra', en: 'Al Hamra & Misfat', ar: 'الحمراء ومسفاة العبريين', gov: 'Ad Dakhiliyah', govAr: 'الداخلية',
    aliases: ['Al Hamra','Misfat','Misfah','Misfat Al Abriyeen','Al Hoota'],
    aliasesAr: ['الحمراء','مسفاة العبريين','مسفاه','كهف الهوتة'],
    blurb: 'a 400-year-old mud-brick town and the terraced mountain village of Misfat Al Abriyeen, with Al Hoota cave nearby.',
    blurbAr: 'بلدة طينية عمرها أربعة قرون وقرية مسفاة العبريين المدرّجة، وبقربهما كهف الهوتة.' },
  { slug: 'salalah', en: 'Salalah', ar: 'صلالة', gov: 'Dhofar', govAr: 'ظفار',
    aliases: ['Salalah','Taqah','Mirbat','Thumrait','Sadah','Dhofar'],
    aliasesAr: ['صلالة','طاقة','مرباط','ثمريت','سدح','ظفار'],
    blurb: 'the frankincense coast — green khareef monsoon hills, blowholes, and ancient incense ports.',
    blurbAr: 'ساحل اللبان — جبال الخريف الخضراء والمنافذ البحرية وموانئ البخور القديمة.' },
  { slug: 'musandam', en: 'Musandam', ar: 'مسندم', gov: 'Musandam', govAr: 'مسندم',
    aliases: ['Musandam','Dibba','Madha','Bukha'],
    aliasesAr: ['مسندم','دبا','مدحاء','بخا'],
    blurb: 'the "Norway of Arabia" — dramatic fjords, dolphin dhow cruises and cliffside villages.',
    blurbAr: '«نرويج العرب» — الأخوار الصخرية ورحلات الدلافين والقرى المعلّقة على الجروف.' },
  { slug: 'khasab', en: 'Khasab', ar: 'خصب', gov: 'Musandam', govAr: 'مسندم',
    aliases: ['Khasab','Telegraph Island'],
    aliasesAr: ['خصب','جزيرة التلغراف'],
    blurb: 'the fjord capital — dhow cruises, snorkelling and Telegraph Island.',
    blurbAr: 'عاصمة الأخوار — رحلات القوارب الشراعية والغوص وجزيرة التلغراف.' },
  { slug: 'sur', en: 'Sur', ar: 'صور', gov: 'Ash Sharqiyah South', govAr: 'جنوب الشرقية',
    aliases: ['Sur','Al Kamil','Jalan','Ras al-Jinz','Ras al Jinz','Ras Al Hadd'],
    aliasesAr: ['صور','الكامل','جعلان','رأس الجنز','راس الجنز','رأس الحد'],
    blurb: 'a dhow-building town and the gateway to the Ras Al Jinz turtle reserve.',
    blurbAr: 'مدينة صناعة السفن الشراعية وبوابة محمية رأس الجنز للسلاحف.' },
  { slug: 'wadi-shab', en: 'Wadi Shab', ar: 'وادي شاب', gov: 'Ash Sharqiyah South', govAr: 'جنوب الشرقية',
    aliases: ['Wadi Shab','Wadishab','Bimmah','Sinkhole','Hawiyat Najm','Tiwi'],
    aliasesAr: ['وادي شاب','بمة','بمه','الهوية','حوية نجم','طيوي'],
    blurb: 'turquoise pools between canyon walls, a hidden waterfall cave, and the Bimmah sinkhole along the same coast.',
    blurbAr: 'برك فيروزية بين جدران الوادي وكهف شلال مخفي، وحوية نجم على الساحل نفسه.' },
  { slug: 'wahiba-sands', en: 'Wahiba Sands', ar: 'رمال الشرقية', gov: 'Ash Sharqiyah North', govAr: 'شمال الشرقية',
    aliases: ['Wahiba','Bidiyah','Bidiyya','Sharqiya Sands','Al Mudhaibi'],
    aliasesAr: ['وهيبة','وهيبه','بدية','بديه','رمال الشرقية','رمال وهيبة','المضيبي'],
    blurb: 'rolling desert dunes, Bedouin camps, dune-bashing and unforgettable starry nights.',
    blurbAr: 'كثبان رملية متموّجة ومخيمات بدوية وتطعيس وليالٍ مرصّعة بالنجوم.' },
  { slug: 'wadi-bani-khalid', en: 'Wadi Bani Khalid', ar: 'وادي بني خالد', gov: 'Ash Sharqiyah North', govAr: 'شمال الشرقية',
    aliases: ['Wadi Bani Khalid','Muqal'],
    aliasesAr: ['وادي بني خالد','مقل','كهف مقل'],
    blurb: 'emerald pools that run year-round, palm shade and the Muqal cave at the head of the valley.',
    blurbAr: 'برك زمردية لا تجفّ طوال العام وظلال النخيل وكهف مقل في أعلى الوادي.' },
  { slug: 'ibra', en: 'Ibra', ar: 'إبراء', gov: 'Ash Sharqiyah North', govAr: 'شمال الشرقية',
    aliases: ['Ibra','Al Qabil','Sinaw'],
    aliasesAr: ['إبراء','ابراء','القابل','سناو'],
    blurb: 'an old caravan town, famous for its Wednesday women\'s souq and restored merchant houses.',
    blurbAr: 'مدينة قوافل قديمة تشتهر بسوق المرأة يوم الأربعاء وبيوت التجّار المرمّمة.' },
  { slug: 'sohar', en: 'Sohar', ar: 'صحار', gov: 'Al Batinah North', govAr: 'شمال الباطنة',
    aliases: ['Sohar','Shinas','Liwa','Saham','Al Khaburah'],
    aliasesAr: ['صحار','شناص','لوى','صحم','الخابورة'],
    blurb: 'a historic Batinah port city, the legendary home of Sindbad the Sailor.',
    blurbAr: 'مدينة ميناء باطنية تاريخية، وموطن السندباد البحري في الأساطير.' },
  { slug: 'rustaq', en: 'Rustaq', ar: 'الرستاق', gov: 'Al Batinah South', govAr: 'جنوب الباطنة',
    aliases: ['Rustaq','Al Hazm','Wadi Bani Awf','Snake Canyon','Wekan','Wakan'],
    aliasesAr: ['الرستاق','الحزم','وادي بني عوف','وكان','قرية وكان'],
    blurb: 'a former capital with a towering fort, hot springs, and the hiking trails of Wadi Bani Awf and Wekan village.',
    blurbAr: 'عاصمة سابقة بقلعة شامخة وعيون حارّة ومسارات وادي بني عوف وقرية وكان.' },
  { slug: 'nakhal', en: 'Nakhal', ar: 'نخل', gov: 'Al Batinah South', govAr: 'جنوب الباطنة',
    aliases: ['Nakhal','Al Awabi','Barka','Thawwarah'],
    aliasesAr: ['نخل','العوابي','بركاء','الثوارة','عين الثوارة'],
    blurb: 'home to a cliff-top fort and the warm Ain A\'Thawwarah hot springs.',
    blurbAr: 'موطن قلعة على سفح الجبل وعين الثوّارة الحارّة.' },
  { slug: 'jabal-akhdar', en: 'Jabal Akhdar', ar: 'الجبل الأخضر', gov: 'Ad Dakhiliyah', govAr: 'الداخلية',
    aliases: ['Jabal Akhdar','Jabal Al Akhdar','Jebel Akhdar','Aljabal Alakhdar','Saiq','Sayq','Wadi Bani Habib'],
    aliasesAr: ['الجبل الاخضر','جبل اخضر','سيق','السيق','وادي بني حبيب'],
    blurb: 'the Green Mountain — terraced rose farms, cool air and canyon-edge viewpoints.',
    blurbAr: 'الجبل الأخضر — مدرّجات الورد والهواء البارد وإطلالات على حافة الأخاديد.' },
  { slug: 'ibri', en: 'Ibri', ar: 'عبري', gov: 'Ad Dhahirah', govAr: 'الظاهرة',
    aliases: ['Ibri','Yanqul','Dhank','Bat','Al Ayn'],
    aliasesAr: ['عبري','ينقل','ضنك','بات','العين'],
    blurb: 'gateway to the UNESCO Bronze-Age tombs of Bat and the western desert.',
    blurbAr: 'بوابة مدافن بات الأثرية المدرجة في اليونسكو والصحراء الغربية.' },
  { slug: 'daymaniyat-islands', en: 'Daymaniyat Islands', ar: 'جزر الديمانيات', gov: 'Al Batinah South', govAr: 'جنوب الباطنة',
    aliases: ['Daymaniyat','Dimaniyat','Damaniyat'],
    aliasesAr: ['الديمانيات','جزر الديمانيات'],
    blurb: 'a protected island reserve off the Batinah coast — coral reefs, turtles, and some of Oman\'s best diving and snorkelling.',
    blurbAr: 'محمية طبيعية من الجزر قبالة ساحل الباطنة — شعاب مرجانية وسلاحف وأفضل مواقع الغوص في عُمان.' },
];

// ── Category catalogue ──
// slug → bilingual name + blurb, and the specialisation terms we match in both
// languages (providers write these as free text, often in Arabic).
const CATEGORIES = [
  { slug: 'cultural', en: 'Cultural', ar: 'ثقافية',
    terms: ['cultural','culture','heritage','traditional','authentic','local food','souq'],
    termsAr: ['ثقاف','تراث','تقليد','اصيل','محلي','سوق'],
    blurb: 'forts, souqs, museums and the living traditions of Omani daily life.',
    blurbAr: 'القلاع والأسواق والمتاحف والتقاليد العُمانية الحيّة.' },
  { slug: 'historical', en: 'Historical', ar: 'تاريخية',
    terms: ['historical','history','archaeology','heritage','fort','castle','unesco'],
    termsAr: ['تاريخ','اثري','اثار','قلعه','حصن','قلاع','تراث'],
    blurb: 'UNESCO sites, ancient forts, tombs and frankincense-trail ports.',
    blurbAr: 'مواقع اليونسكو والحصون القديمة والمدافن وموانئ طريق اللبان.' },
  { slug: 'desert', en: 'Desert', ar: 'صحراوية',
    terms: ['desert','dune','safari','bedouin','camel','sand'],
    termsAr: ['صحرا','كثبان','رمال','بدو','جمال','تطعيس','سفاري'],
    blurb: 'dune-bashing, camel rides, Bedouin camps and desert star-gazing.',
    blurbAr: 'تطعيس الكثبان وركوب الجمال والمخيمات البدوية ومراقبة النجوم.' },
  { slug: 'mountain', en: 'Mountain', ar: 'جبلية',
    terms: ['mountain','trekking','hiking','hike','jebel','jabal','climb','via ferrata','outdoor'],
    termsAr: ['جبل','جبال','مشي','تسلق','هايك','مرتفعات'],
    blurb: 'hikes and via-ferrata across the Hajar range and the Green Mountain.',
    blurbAr: 'مسارات المشي والتسلّق عبر سلسلة الحجر والجبل الأخضر.' },
  { slug: 'marine', en: 'Marine', ar: 'بحرية',
    terms: ['marine','diving','dive','snorkel','dolphin','beach','sea','boat','dhow','turtle','island'],
    termsAr: ['بحر','غوص','سنوركل','دلافين','شاطئ','قارب','سفين','سلاحف','جزر'],
    blurb: 'diving, snorkelling, dolphin-watching and dhow cruises along the coast.',
    blurbAr: 'الغوص والسنوركلنج ومشاهدة الدلافين ورحلات القوارب الشراعية.' },
  { slug: 'adventure', en: 'Adventure', ar: 'مغامرات',
    terms: ['adventure','canyon','wadi','caving','cave','climb','off-road','4x4','camping','nature'],
    termsAr: ['مغامر','وادي','وديان','كهف','كهوف','تخييم','طبيعه','دهس'],
    blurb: 'wadi swimming, canyoning, caving and off-road expeditions.',
    blurbAr: 'السباحة في الأودية والأخاديد واستكشاف الكهوف ورحلات الطرق الوعرة.' },
  { slug: 'family', en: 'Family & Groups', ar: 'عائلية وجماعية',
    terms: ['family','families','group','groups','kids','children','school','corporate','luxury'],
    termsAr: ['عائل','عوائل','مجموعات','اطفال','مدارس','شركات','فاخر'],
    blurb: 'trips paced for families, school groups and corporate visitors, with child-friendly stops.',
    blurbAr: 'رحلات مصمّمة للعائلات والمجموعات المدرسية وزوّار الشركات، بمحطات مناسبة للأطفال.' },
  { slug: 'aerial', en: 'Aerial Tours', ar: 'رحلات جوية',
    terms: ['aerial','flight','flying','scenic flight','balloon','hot air balloon','paraglide','paragliding','glider','gliding','skydive','helicopter'],
    termsAr: ['طيران','منطاد','شراعي','جوي','مظلات','هليكوبتر'],
    blurb: 'hot-air balloon rides, scenic flights, paragliding and aerial views of Oman.',
    blurbAr: 'رحلات المناطيد والطيران الشراعي والرحلات الجوية الخلابة فوق عُمان.' },
];

const PLACE_BY_SLUG = Object.fromEntries(PLACES.map(p => [p.slug, p]));
const CAT_BY_SLUG   = Object.fromEntries(CATEGORIES.map(c => [c.slug, c]));

// Read a provider field that may be a JSON array, a real array, or free text.
function asList(v) {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === 'string' && v.trim()) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch { /* not JSON — treat as a single free-text value */ }
    return [v];
  }
  return [];
}

// True if any of the provider's values contains any alias, in either language.
function matchesAny(values, aliases) {
  const vals = values.map(norm).filter(Boolean);
  if (!vals.length) return false;
  return aliases.some(a => { const n = norm(a); return n && vals.some(v => v.includes(n)); });
}

function placeAliases(place) {
  return [...(place.aliases || []), ...(place.aliasesAr || [])];
}
function categoryTerms(cat) {
  return [...(cat.terms || []), ...(cat.termsAr || [])];
}

// True if a guide's destinations cover any alias of this place.
function guideServesPlace(guide, place) {
  return matchesAny(asList(guide && guide.destinations), placeAliases(place));
}

// True if a guide's specialisations match any term of this category. Falls back
// to the bio so a guide who described their speciality in prose still surfaces.
function guideMatchesCategory(guide, cat) {
  const vals = asList(guide && guide.specialisations);
  if (guide && guide.bio) vals.push(String(guide.bio));
  return matchesAny(vals, categoryTerms(cat));
}

// Companies store their coverage in companyDestinations; fall back to the
// description so a company that only wrote prose still lands on a page.
function companyServesPlace(company, place) {
  const vals = asList(company && company.companyDestinations);
  if (company && company.companyDescription) vals.push(String(company.companyDescription));
  if (company && company.companyName) vals.push(String(company.companyName));
  return matchesAny(vals, placeAliases(place));
}

module.exports = {
  PLACES, CATEGORIES, PLACE_BY_SLUG, CAT_BY_SLUG,
  guideServesPlace, guideMatchesCategory, companyServesPlace,
  norm, asList, matchesAny,
};
