#!/usr/bin/env node
/**
 * Seed tour packages for existing demo guides.
 * Each guide gets 2-3 fully-featured tours with variants, add-ons, dates, itinerary.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const todayPlus = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const DEFAULT_DATES = [7, 14, 21, 28, 35, 42, 50, 60, 75, 90].map(todayPlus);

const STANDARD_ADDONS = [
  { id: 'a-pickup',  name: 'استلام من الفندق · Hotel Pickup', description: 'استلام وتوصيل من فندقك · Round-trip from your hotel', price: 8 },
  { id: 'a-photos',  name: 'صور احترافية · Pro Photos',        description: 'مصور محترف يرافق الجولة · Photographer included',   price: 15 },
  { id: 'a-lunch',   name: 'وجبة فاخرة · Premium Lunch',        description: 'غداء في مطعم تقليدي · Traditional restaurant meal',  price: 12 },
];

const TOURS = [
  // ─── KHALID AL-RAWAHI (Sur · Musandam · Marine) ─────────────────
  {
    providerId: 'guide-003',
    title: 'رحلة الإبحار في خوران مسندم · Musandam Dhow Cruise',
    category: 'Marine',
    destination: 'Musandam',
    region: 'Musandam',
    difficulty: 'easy',
    duration_days: 1,
    max_group_size: 12,
    price_adult: 45,
    price_child: 25,
    description: 'إبحر في أجمل خوران الخليج، شاهد الدلافين، اسبح في المياه الفيروزية، واستمتع بغداء عُماني أصيل على ظهر السنبوك التقليدي.\n\nCruise the dramatic fjords of Musandam — Arabia\'s Norway. Watch dolphins, snorkel in turquoise waters, and enjoy a traditional Omani lunch on board.',
    meeting_point: 'ميناء خصب 8:00 صباحاً · Khasab Port 8:00 AM',
    includes: ['Boat & captain', 'Snorkeling gear', 'Omani lunch', 'Water & dates', 'Life jackets'],
    highlights: ['Dolphin watching guaranteed', 'Two snorkeling stops', 'Traditional dhow boat', 'Stunning fjord scenery', 'Small group max 12'],
    variants: [
      { id: 'v-std', name: 'عادية · Standard', description: 'الرحلة الأساسية مع غداء · Base tour with lunch',                   priceAdult: 45, priceChild: 25 },
      { id: 'v-prm', name: 'مميّزة · Premium',  description: 'غداء فاخر + معدات غطس متقدمة · Premium lunch + diving gear',         priceAdult: 75, priceChild: 40 },
      { id: 'v-vip', name: 'VIP خاصة',          description: 'سنبوك خاص لمجموعتك + مصور · Private dhow + photographer included', priceAdult: 150, priceChild: 80 },
    ],
    discountPercent: 15,
    offerLabel: 'عرض الصيف · Summer Special',
    offerUntil: todayPlus(60),
  },
  {
    providerId: 'guide-003',
    title: 'مشاهدة السلاحف في رأس الجنز · Ras al-Jinz Turtle Night',
    category: 'Wildlife',
    destination: 'Ras al-Jinz',
    region: 'Al Sharqiyah',
    difficulty: 'easy',
    duration_days: 1,
    max_group_size: 8,
    price_adult: 35,
    price_child: 20,
    description: 'تجربة ليلية ساحرة لمشاهدة السلاحف الخضراء وهي تضع بيضها على الشاطئ. واحدة من أهم مواقع التعشيش في العالم.\n\nWitness green sea turtles nesting on the beach in this unforgettable night experience. One of the world\'s most important nesting sites.',
    meeting_point: 'بوابة محمية رأس الجنز · Ras al-Jinz Reserve gate, 7:30 PM',
    includes: ['Park entry fee', 'Guided night walk', 'Photography rights', 'Local guide'],
    highlights: ['100% turtle sighting guarantee', 'Educational presentation', 'Stargazing included', 'Photography allowed (no flash)'],
    variants: [
      { id: 'v-std', name: 'عادية · Standard',  description: 'الزيارة الأساسية · Basic guided visit',                              priceAdult: 35, priceChild: 20 },
      { id: 'v-prm', name: 'مميّزة · Premium',   description: 'إقامة في الإيكولودج · Stay at the Eco-lodge',                       priceAdult: 90, priceChild: 50 },
    ],
  },

  // ─── MOHAMMED AL-BALUSHI (Muscat · Nizwa · Historical · Desert) ──
  {
    providerId: 'guide-001',
    title: 'درب التراث في مسقط · Muscat Heritage Trail',
    category: 'Historical',
    destination: 'Muscat',
    region: 'Muscat',
    difficulty: 'easy',
    duration_days: 1,
    max_group_size: 10,
    price_adult: 40,
    price_child: 22,
    description: 'اكتشف عاصمة عُمان الساحرة: جامع السلطان قابوس، سوق مطرح القديم، دار الأوبرا، والكورنيش. تاريخ ١٠٠٠ سنة في يوم واحد.\n\nDiscover Oman\'s captivating capital: Grand Mosque, Muttrah Souq, Royal Opera House, and the Corniche. 1000 years of history in one day.',
    meeting_point: 'مدخل جامع السلطان قابوس · Sultan Qaboos Mosque entrance, 8:30 AM',
    includes: ['Air-conditioned vehicle', 'All entry fees', 'Bottled water', 'Traditional Omani lunch'],
    highlights: ['World\'s 2nd largest chandelier', 'Authentic Muttrah Souq', 'Royal Opera House tour', 'Sunset at Corniche'],
    variants: [
      { id: 'v-std', name: 'عادية · Standard', description: 'الجولة الأساسية مع غداء · Base tour with lunch',                       priceAdult: 40,  priceChild: 22 },
      { id: 'v-prm', name: 'مميّزة · Premium',  description: 'سيارة فاخرة + غداء في مطعم راقٍ · Luxury car + upscale restaurant',    priceAdult: 75,  priceChild: 40 },
      { id: 'v-vip', name: 'VIP خاصة',          description: 'مرشد خاص + سيارة بسائق · Private guide + chauffeur',                 priceAdult: 130, priceChild: 70 },
    ],
  },
  {
    providerId: 'guide-001',
    title: 'سفاري رمال الوهيبة · Wahiba Sands Overnight Safari',
    category: 'Desert',
    destination: 'Wahiba Sands',
    region: 'Al Sharqiyah',
    difficulty: 'moderate',
    duration_days: 2,
    max_group_size: 8,
    price_adult: 120,
    price_child: 65,
    description: 'مغامرة صحراوية لا تُنسى: ركوب الكثبان بسيارات الدفع الرباعي، ركوب الجمال عند الغروب، عشاء بدوي تقليدي، وليلة تحت آلاف النجوم.\n\nUnforgettable desert adventure: 4x4 dune bashing, camel rides at sunset, traditional Bedouin dinner, and a night under thousands of stars.',
    meeting_point: 'الانطلاق من فندقك في مسقط · Pickup from your Muscat hotel, 9:00 AM',
    includes: ['4x4 transport', 'Bedouin camp accommodation', 'All meals (lunch, dinner, breakfast)', 'Camel ride', 'Sandboarding'],
    highlights: ['Sunset dune bashing', 'Authentic Bedouin hospitality', 'Stargazing in pristine desert', 'Sunrise camel ride', 'Traditional henna'],
    variants: [
      { id: 'v-std', name: 'عادية · Standard',  description: 'خيمة مشتركة · Shared tent accommodation',                             priceAdult: 120, priceChild: 65 },
      { id: 'v-prm', name: 'مميّزة · Premium',   description: 'خيمة خاصة + حمام · Private tent with bathroom',                       priceAdult: 200, priceChild: 110 },
      { id: 'v-vip', name: 'VIP فاخرة',          description: 'جناح صحراوي فاخر + رحلة بالمنطاد · Luxury suite + hot-air balloon',    priceAdult: 380, priceChild: 200 },
    ],
    discountPercent: 10,
    offerLabel: 'عرض الحجز المبكر · Early Bird',
    offerUntil: todayPlus(30),
  },
  {
    providerId: 'guide-001',
    title: 'قلعة نزوى والسوق التقليدي · Nizwa Fort & Souq',
    category: 'Historical',
    destination: 'Nizwa',
    region: 'Ad Dakhiliyah',
    difficulty: 'easy',
    duration_days: 1,
    max_group_size: 12,
    price_adult: 35,
    price_child: 20,
    description: 'اكتشف عاصمة عُمان القديمة وقلب التراث: قلعة نزوى التاريخية (1668م)، السوق الشهير بفضياته، وحلقة الماعز يوم الجمعة.\n\nDiscover Oman\'s ancient capital: Nizwa Fort (1668), the famous silver souq, and the legendary Friday goat market.',
    meeting_point: 'بوابة قلعة نزوى · Nizwa Fort entrance, 9:00 AM',
    includes: ['Fort entry', 'Local guide', 'Halwa & kahwa tasting', 'Photography assistance'],
    highlights: ['350-year-old fort tower', 'Friday goat market (Fri only)', 'Traditional silver shopping', 'Halwa making demo'],
    variants: [
      { id: 'v-std', name: 'عادية · Standard',  description: 'الجولة الأساسية · Basic guided tour',                                priceAdult: 35,  priceChild: 20 },
      { id: 'v-prm', name: 'مميّزة · Premium',   description: 'مع غداء عُماني + ورشة حلوى · Omani lunch + halwa workshop',           priceAdult: 65,  priceChild: 35 },
    ],
  },

  // ─── FATIMA AL-HARTHI (Salalah · Dhofar · Nature) ────────────────
  {
    providerId: 'guide-002',
    title: 'سحر خريف صلالة · Salalah Khareef Magic',
    category: 'Cultural',
    destination: 'Salalah',
    region: 'Dhofar',
    difficulty: 'easy',
    duration_days: 1,
    max_group_size: 10,
    price_adult: 50,
    price_child: 28,
    description: 'تجربة صلالة المذهلة خلال موسم الخريف: شلالات وادي دربات، شواطئ المغسيل، شجرة بوبيب التاريخية، ومزارع جوز الهند.\n\nExperience Salalah\'s magical monsoon season: Wadi Darbat waterfalls, Mughsail beaches, the legendary Boswellia tree, and coconut plantations.',
    meeting_point: 'فندقك في صلالة · Your Salalah hotel, 8:00 AM',
    includes: ['Air-conditioned 4x4', 'All entry fees', 'Lunch at local restaurant', 'Fresh coconut tasting', 'Frankincense gift'],
    highlights: ['Lush green mountains (Jun-Sep)', 'Wadi Darbat waterfall', 'Mughsail blowholes', 'Frankincense Land of UNESCO'],
    variants: [
      { id: 'v-std', name: 'عادية · Standard',  description: 'الجولة الأساسية · Group tour up to 10',                              priceAdult: 50,  priceChild: 28 },
      { id: 'v-prm', name: 'مميّزة · Premium',   description: 'مجموعة صغيرة (5 كحد أقصى) · Small group max 5',                     priceAdult: 95,  priceChild: 50 },
      { id: 'v-vip', name: 'VIP خاصة',           description: 'جولة خاصة لعائلتك فقط · Fully private for your family',              priceAdult: 180, priceChild: 95 },
    ],
    discountPercent: 20,
    offerLabel: 'عرض موسم الخريف · Khareef Special',
    offerUntil: todayPlus(45),
  },
  {
    providerId: 'guide-002',
    title: 'استكشاف وادي شاب · Wadi Shab Hike & Swim',
    category: 'Adventure',
    destination: 'Wadi Shab',
    region: 'Al Sharqiyah',
    difficulty: 'moderate',
    duration_days: 1,
    max_group_size: 8,
    price_adult: 40,
    price_child: 22,
    description: 'مغامرة في أجمل وادٍ في عُمان: مسير 45 دقيقة بين الصخور، سباحة في برك زمردية، وكهف الشلال السري.\n\nAdventure through Oman\'s most beautiful wadi: 45-min trek between cliffs, swim in emerald pools, and discover the hidden waterfall cave.',
    meeting_point: 'موقف وادي شاب · Wadi Shab parking, 7:30 AM',
    includes: ['Boat across pond', 'Snorkeling mask', 'Safety briefing', 'Dry bags', 'Energy snacks'],
    highlights: ['Hidden waterfall cave (swim through)', 'Crystal clear pools', 'Cliff jumping (optional)', 'Stunning canyon scenery'],
    variants: [
      { id: 'v-std', name: 'عادية · Standard',  description: 'الجولة الأساسية · Group adventure',                                  priceAdult: 40, priceChild: 22 },
      { id: 'v-prm', name: 'مميّزة · Premium',   description: 'مع غداء بيكنيك + معدات تصوير · Picnic lunch + GoPro footage',         priceAdult: 70, priceChild: 38 },
    ],
  },
];

(async () => {
  console.log('🌱 Seeding tour packages...\n');
  let created = 0;
  let skipped = 0;

  for (const t of TOURS) {
    const id = 'pkg-' + uuidv4().slice(0, 12);
    const pkg = {
      id,
      providerId: t.providerId,
      providerType: 'guide',
      guideId: t.providerId,
      title: t.title,
      description: t.description,
      destination: t.destination,
      region: t.region,
      category: t.category,
      difficulty: t.difficulty,
      duration_days: t.duration_days,
      max_group_size: t.max_group_size,
      price_adult: t.price_adult,
      price_child: t.price_child,
      currency: 'OMR',
      includes: t.includes || [],
      excludes: [],
      itinerary: t.itinerary || [],
      meeting_point: t.meeting_point || '',
      languages: ['Arabic', 'English'],
      images: [],
      cover_image: '',
      cancellation_policy: 'flexible',
      isPublished: true,
      isFeatured: false,
      discountPercent: t.discountPercent || 0,
      offerLabel: t.offerLabel || null,
      offerUntil: t.offerUntil || null,
      variants: t.variants || [],
      addons: STANDARD_ADDONS,
      availableDates: DEFAULT_DATES,
      highlights: t.highlights || [],
      rating: 4.5 + Math.random() * 0.5,
      totalReviews: Math.floor(Math.random() * 30) + 5,
      totalBookings: Math.floor(Math.random() * 50) + 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from('tour_packages').insert(pkg);
      if (error) {
        console.log(`  ✗ ${t.title.slice(0, 50)} — ${error.message}`);
        skipped++;
      } else {
        console.log(`  ✓ ${t.title.slice(0, 50)}`);
        created++;
      }
    } catch (e) {
      console.log(`  ✗ ${t.title.slice(0, 50)} — ${e.message}`);
      skipped++;
    }
  }

  console.log(`\n✅ Done: ${created} created, ${skipped} skipped\n`);
})();
