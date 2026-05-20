/* ── Guideon i18n — Arabic / English ── */

const TRANSLATIONS = {
  en: {
    /* ── NAV ── */
    nav_brand:        'Guideon',
    nav_home:         'Home',
    nav_find:         'Find a Guide',
    nav_login:        'Log In',
    nav_signup:       'Sign Up',
    nav_dashboard:    'My Dashboard',
    nav_signout:      'Sign Out',

    /* ── HOMEPAGE ── */
    hero_badge:       'Certified Ministry-Licensed Guides',
    hero_title:       'Discover Oman With a',
    hero_highlight:   'Verified Local Expert',
    hero_sub:         'Connect with certified tourist guides across Muscat, Nizwa, Salalah, Musandam and beyond. Verified licences. Genuine experiences. Instant booking.',
    search_dest:      'Destination',
    search_dest_all:  'All Destinations',
    search_lang:      'Language',
    search_lang_any:  'Any Language',
    search_date:      'Tour Date',
    search_btn:       '🔍 Search Guides',
    stat_guides:      'Certified Guides',
    stat_dests:       'Destinations Covered',
    stat_rating:      'Average Rating',
    stat_tourists:    'Happy Tourists',
    sec_top:          'Top-Rated Guides',
    sec_view_all:     'View All →',
    sec_how:          'How It Works',
    step1_title:      '1. Search & Filter',
    step1_desc:       'Browse verified guides by destination, language, and date. Read genuine reviews from other travellers.',
    step2_title:      '2. Book Instantly',
    step2_desc:       'Submit a booking request for your chosen guide. The guide accepts and your tour is confirmed.',
    step3_title:      '3. Explore Oman',
    step3_desc:       'Enjoy an authentic, expertly guided experience. After the tour, leave a review to help future travellers.',
    sec_dests:        'Popular Destinations',
    footer_desc:      'Connecting tourists with certified, Ministry-licensed guides across Oman. Authentic experiences, verified professionals.',
    footer_platform:  'Platform',
    footer_dests:     'Destinations',
    footer_demo:      'Demo Accounts',
    footer_bottom:    'Guideon © 2025. All rights reserved.',
    loading_guides:   'Loading guides...',
    no_guides:        'No guides available yet.',

    /* ── ABOUT SECTION ── */
    about_title:      'About Guideon',
    about_p1:         "Guideon is Oman's leading platform connecting travellers with Ministry-licensed local guides. Founded in 2025, we make authentic Omani experiences accessible to everyone — from ancient forts to desert dunes.",
    about_p2:         'Every guide on our platform is personally verified, licensed by the Ministry of Heritage & Tourism, and committed to delivering genuine, memorable journeys across the Sultanate.',
    about_join:       'Join the Community',
    about_v1_title:   'Our Mission',
    about_v1_desc:    'To make authentic Omani travel experiences accessible to every visitor through verified, professional local guides.',
    about_v2_title:   'Our Vision',
    about_v2_desc:    "To become the most trusted travel platform in Oman, celebrating the country's rich heritage and natural beauty.",
    about_v3_title:   'Our Values',
    about_v3_desc:    'Authenticity, transparency, and community. We connect people, not just places — supporting local guides and their families.',
    about_v4_title:   'Ministry Certified',
    about_v4_desc:    'Every guide holds an official Ministry of Heritage & Tourism licence — your guarantee of quality and professionalism.',

    /* ── SEARCH PAGE ── */
    search_all_dest:  'All Destinations',
    search_any_lang:  'Any',
    search_any_rating:'Any',
    search_sort_lbl:  'Sort By',
    sort_rating:      'Rating ↓',
    sort_price_asc:   'Price ↑',
    sort_price_desc:  'Price ↓',
    filter_min_rating:'Min Rating',
    back_home:        '← Back to Home',
    results_found:    (n) => `${n} guide${n !== 1 ? 's' : ''} found`,
    no_results:       'No guides found',
    no_results_sub:   'Try adjusting your filters or choosing a different date.',
    clear_filters:    'Clear Filters',
    per_day:          '/day',
    view_profile:     'View Profile →',
    reviews_count:    (n) => `${n} reviews`,
    rating_lbl:       'Rating',

    /* ── GUIDE PROFILE ── */
    about:            'About',
    specialisations:  'Specialisations',
    reviews_title:    'Tourist Reviews',
    no_reviews:       'No reviews yet.',
    verified_lbl:     '✓ Ministry Verified — Licence:',
    pending_lbl:      '⏳ Pending Verification',
    book_title:       'Request Booking',
    tour_date:        'Tour Date *',
    select_date:      '— Select an available date —',
    duration:         'Duration *',
    full_day:         'Full Day',
    half_day:         'Half Day (60%)',
    destination:      'Destination',
    select_dest:      '— Select destination —',
    participants:     'Participants',
    special_req:      'Special Requests (optional)',
    special_placeholder: 'Any preferences or notes for the guide...',
    price_label:      'Price',
    total_label:      'Total',
    book_btn:         'Request Booking',
    book_note:        'The guide will confirm your request within 24 hours.',
    signin_to_book:   'Sign in to book this guide.',
    only_tourist:     'Only tourist accounts can make bookings.',
    guide_not_found:  'Guide not found',
    back_search:      'Back to Search',

    /* ── LOGIN ── */
    login_title:      'Welcome Back',
    login_sub:        'Sign in to manage your bookings',
    email_lbl:        'Email Address',
    email_ph:         'you@example.com',
    pass_lbl:         'Password',
    pass_ph:          '••••••••',
    login_btn:        'Sign In',
    login_loading:    'Signing in...',
    demo_accounts:    'Quick Login — Demo Accounts',
    no_account:       "Don't have an account?",
    signup_link:      'Sign Up',

    /* ── REGISTER ── */
    reg_title:        'Create Your Account',
    reg_sub:          'Join Guideon as a Tourist or a Certified Guide',
    tab_tourist:      '👤 Tourist',
    tab_guide:        '🎒 Licensed Guide',
    full_name:        'Full Name *',
    full_name_ph:     'Your full name',
    email_addr:       'Email Address *',
    pass_req:         'Password *',
    pass_ph2:         'Min 8 characters',
    phone_lbl:        'Phone',
    phone_ph:         '+968 XXXX XXXX',
    nationality:      'Nationality',
    nat_ph:           'e.g. British',
    pref_lang:        'Preferred Language',
    guide_note:       'Note: Your account will be reviewed and verified by an administrator before appearing in search results.',
    licence_lbl:      'Ministry Licence Number *',
    licence_ph:       'MOT-YYYY-XXXX',
    price_day:        'Price Per Day (OMR) *',
    langs_spoken:     'Languages Spoken *',
    langs_ph:         'Arabic, English, French',
    dests_covered:    'Destinations Covered *',
    dests_ph:         'Muscat, Nizwa, Bahla',
    specs_lbl:        'Specialisations *',
    specs_ph:         'Historical Sites, Desert Safaris, Cultural Tours',
    bio_lbl:          'Professional Bio',
    bio_ph:           'Tell tourists about your experience and expertise...',
    reg_btn:          'Create Account',
    reg_loading:      'Creating account...',
    have_account:     'Already have an account?',
    signin_link:      'Sign In',

    /* ── TOURIST DASHBOARD ── */
    tourist_dash:     'My Dashboard 📋',
    total_bk:         'Total Bookings',
    confirmed_bk:     'Confirmed',
    pending_bk:       'Pending',
    completed_bk:     'Completed',
    tab_all:          'All',
    tab_pending:      'Pending',
    tab_confirmed:    'Confirmed',
    tab_completed:    'Completed',
    tab_cancelled:    'Cancelled',
    find_guides:      '🔍 Find More Guides',
    no_bookings:      'No bookings',
    no_bookings_sub:  'Start exploring guides to make your first booking!',
    view_guide:       'View Guide',
    write_review:     '✍ Write Review',
    cancel_bk:        'Cancel',
    cancel_confirm:   'Are you sure you want to cancel this booking?\n\nNote: Cancellations must be at least 48 hours before the tour date.',
    review_title:     'Write a Review',
    rating_req:       'Rating',
    review_lbl:       'Your Review',
    review_ph:        'Share your experience with this guide...',
    cancel_btn:       'Cancel',
    submit_review:    'Submit Review',
    rating_required:  'Please select a star rating.',
    half_day_lbl:     '½ Day',
    full_day_lbl:     'Full Day',
    person_lbl:       'participant',
    persons_lbl:      'participants',

    /* ── GUIDE DASHBOARD ── */
    guide_dash:       'Guide Dashboard',
    total_bk2:        'Total Bookings',
    pending_req:      'Pending Requests',
    total_earn:       'Total Earnings (OMR)',
    avg_rating:       'Average Rating',
    pending_section:  '⏳ Pending Booking Requests',
    confirmed_section:'✅ Upcoming Confirmed Bookings',
    past_section:     '📋 Past Bookings',
    manage_avail:     '📅 Manage Availability',
    avail_note:       'Click dates to toggle availability for the next 60 days.',
    save_avail:       'Save Availability',
    accept_btn:       '✓ Accept',
    reject_btn:       '✗ Reject',
    no_pending:       'No pending requests.',
    no_confirmed:     'No upcoming confirmed bookings.',
    no_past:          'No past bookings.',
    accept_confirm:   'Accept this booking?',
    reject_confirm:   'Reject this booking?',

    /* ── ADMIN ── */
    admin_dash:       'Admin Dashboard 🛡️',
    admin_panel:      '🛡️ Admin Panel',
    total_guides:     'Total Guides',
    total_tourists:   'Total Tourists',
    total_bookings:   'Total Bookings',
    revenue:          'Revenue (OMR)',
    tab_pending_g:    '⏳ Pending Approvals',
    tab_guides:       '🎒 All Guides',
    tab_tourists:     '👤 Tourists',
    tab_bookings:     '📋 All Bookings',
    approve_btn:      '✓ Approve',
    suspend_btn:      'Suspend',
    unsuspend_btn:    'Unsuspend',
    verify_btn:       'Verify',
    complete_btn:     'Mark Complete',
    no_pending_g:     'No pending approvals',
    no_pending_sub:   'All guide applications have been reviewed.',
    status_verified:  'Verified',
    status_suspended: 'Suspended',
    status_pending2:  'Pending',

    /* ── TOURHQ NEW SECTIONS ── */
    benefits_title:   'Why Choose Guideon?',
    benefit1_title:   'Largest Guide Network in Oman',
    benefit1_desc:    'Connect with certified, Ministry-licensed guides across all major Oman destinations.',
    benefit2_title:   'Fully Customizable Itineraries',
    benefit2_desc:    'Every tour is tailored to your group size, language, budget, and interests.',
    benefit3_title:   'Book Directly with Local Guides',
    benefit3_desc:    'No middlemen. Support local communities and get authentic Omani experiences.',
    guides_in_city:   'guides available',
    explore_tours:    'Explore Tours →',
    blog_title:       'Oman Travel Tips & Stories',
    blog_read:        'Read More →',
    app_title:        'Plan Your Trip on the Go',
    app_sub:          'Access your bookings, chat with guides, and explore Oman — all from your phone.',
    app_soon:         'Coming Soon',
    seen_on:          'As Featured In',
    payment_accept:   'Secure Payment Methods',
    dark_mode:        'Dark Mode',
    light_mode:       'Light Mode',
    online_exp:       'Online Experiences',
    online_exp_sub:   'Explore Oman virtually with our certified guides.',
    popular_tours:    'Popular Tours',
    duration_lbl:     'Duration',
    from_price:       'From',
    group_lbl:        'group',

    /* ── SUPER GUIDE (TourHQ) ── */
    super_guide:      '⭐ Super Guide',
    super_guide_desc: 'Top-rated verified guide with proven excellence',

    /* ── CURRENCY ── */
    currency_lbl:     'Currency',

    /* ── PLAN MY TRIP (TourHQ) ── */
    plan_trip_title:  'Plan My Holiday',
    plan_trip_sub:    "Tell us your dream trip — our verified guides will tailor an itinerary just for you.",
    plan_trip_btn:    '✈️ Plan My Holiday',
    trip_dest:        'Destination',
    trip_from:        'From Date',
    trip_to:          'To Date (optional)',
    trip_group:       'Group Size',
    trip_lang:        'Preferred Language',
    trip_spec:        'Tour Type',
    trip_budget:      'Daily Budget (OMR)',
    trip_notes:       'Notes & Preferences',
    trip_notes_ph:    'Tell guides about your interests, mobility needs, children, etc.',
    trip_submit:      'Post Trip Request',
    trip_loading:     'Posting...',
    trip_posted:      '✅ Request posted! Matching guides will respond soon.',
    open_requests:    '✈️ Open Trip Requests',
    matching_trips:   'Trip Requests Matching Your Area',
    no_trips:         'No open trip requests yet.',
    no_my_trips:      "You haven't posted any trip requests yet.",
    contact_tourist:  'Contact Tourist',
    close_request:    'Close Request',
    trip_status_open: 'Open',
    trip_status_closed:'Closed',
    group_size_lbl:   'Group',
    budget_lbl:       'Budget',
    trip_dates_lbl:   'Dates',

    /* ── DEPOSIT (TourHQ) ── */
    deposit_lbl:      'Payment Option',
    deposit_20:       '20% Deposit',
    deposit_50:       '50% Deposit',
    deposit_full:     'Full Payment',
    deposit_note:     'Remaining balance paid to guide on the day of the tour.',

    /* ── TRUST SECTION ── */
    trust_guides:     'Verified Guides',
    trust_dests:      'Destinations',
    trust_reviews:    'Happy Reviews',
    trust_since:      'Est. 2025',

    /* ── WISHLIST ── */
    wishlist_saved:   '❤️ Saved to Wishlist',
    wishlist_removed: 'Removed from Wishlist',
    saved_guides:     'Saved Guides',
    my_wishlist:      '❤️ My Wishlist',
    wishlist_empty:   'No saved guides yet.',
    wishlist_empty_sub: 'Tap the ♡ on any guide card to save them here.',
    clear_wishlist:   'Clear All',

    /* ── BADGES ── */
    guest_fav:        '⭐ Guest Favourite',
    top_rated:        '🏆 Top Rated',
    new_guide:        '🆕 New',

    /* ── PRICE RANGE ── */
    price_range:      'Price Range (OMR)',
    min_price:        'Min',
    max_price:        'Max',

    /* ── CATEGORIES ── */
    cat_all:          'All',
    cat_historical:   'Historical',
    cat_desert:       'Desert Safari',
    cat_cultural:     'Cultural',
    cat_nature:       'Nature',
    cat_marine:       'Marine',
    cat_adventure:    'Adventure',

    /* ── PARTICIPANTS ── */
    guests_lbl:       'Guests',
    guest_singular:   'guest',
    guest_plural:     'guests',

    /* ── STATUS ── */
    status_pending:   'Pending',
    status_confirmed: 'Confirmed',
    status_completed: 'Completed',
    status_cancelled: 'Cancelled',
    na_lbl:           'N/A',
    omr_day:          'OMR',
  },

  ar: {
    /* ── NAV ── */
    nav_brand:        'Guideon',
    nav_home:         'الرئيسية',
    nav_find:         'ابحث عن مرشد',
    nav_login:        'تسجيل الدخول',
    nav_signup:       'إنشاء حساب',
    nav_dashboard:    'لوحة التحكم',
    nav_signout:      'تسجيل الخروج',

    /* ── HOMEPAGE ── */
    hero_badge:       'مرشدون معتمدون من وزارة التراث والسياحة',
    hero_title:       'اكتشف عُمان مع',
    hero_highlight:   'خبير محلي موثّق',
    hero_sub:         'تواصل مع مرشدين سياحيين معتمدين في مسقط ونزوى وصلالة ومسندم وما بعدها. تراخيص موثّقة. تجارب حقيقية. حجز فوري.',
    search_dest:      'الوجهة',
    search_dest_all:  'جميع الوجهات',
    search_lang:      'اللغة',
    search_lang_any:  'أي لغة',
    search_date:      'تاريخ الجولة',
    search_btn:       '🔍 ابحث عن مرشد',
    stat_guides:      'مرشد معتمد',
    stat_dests:       'وجهة سياحية',
    stat_rating:      'متوسط التقييم',
    stat_tourists:    'سائح سعيد',
    sec_top:          'أعلى المرشدين تقييماً',
    sec_view_all:     'عرض الكل →',
    sec_how:          'كيف يعمل النظام',
    step1_title:      '١. ابحث وفلتر',
    step1_desc:       'تصفّح المرشدين المعتمدين حسب الوجهة واللغة والتاريخ. اقرأ مراجعات حقيقية من مسافرين آخرين.',
    step2_title:      '٢. احجز فوراً',
    step2_desc:       'أرسل طلب حجز للمرشد الذي اخترته. يقبل المرشد ويتم تأكيد جولتك.',
    step3_title:      '٣. استكشف عُمان',
    step3_desc:       'استمتع بتجربة أصيلة بتوجيه من خبير. بعد الجولة، اترك مراجعة لمساعدة المسافرين الآخرين.',
    sec_dests:        'الوجهات الشعبية',
    footer_desc:      'نربط السياح بمرشدين معتمدين من وزارة التراث والسياحة عبر عُمان. تجارب أصيلة، مهنيون موثّقون.',
    footer_platform:  'المنصة',
    footer_dests:     'الوجهات',
    footer_demo:      'حسابات تجريبية',
    footer_bottom:    'Guideon © ٢٠٢٥. جميع الحقوق محفوظة.',
    loading_guides:   'جارٍ تحميل المرشدين...',
    no_guides:        'لا يوجد مرشدون حتى الآن.',

    /* ── ABOUT SECTION ── */
    about_title:      'عن Guideon',
    about_p1:         'Guideon هي المنصة الرائدة في عُمان التي تربط المسافرين بمرشدين سياحيين معتمدين من وزارة التراث والسياحة. تأسست عام ٢٠٢٥ لتجعل التجارب العُمانية الأصيلة متاحة للجميع — من القلاع الأثرية إلى الكثبان الرملية.',
    about_p2:         'كل مرشد على منصتنا موثّق شخصياً، ويحمل ترخيصاً رسمياً من وزارة التراث والسياحة، وملتزم بتقديم رحلات حقيقية لا تُنسى في أرجاء السلطنة.',
    about_join:       'انضم إلى المجتمع',
    about_v1_title:   'مهمتنا',
    about_v1_desc:    'جعل التجارب السياحية الأصيلة في عُمان متاحة لكل زائر من خلال مرشدين محليين موثّقين ومحترفين.',
    about_v2_title:   'رؤيتنا',
    about_v2_desc:    'أن نكون المنصة السياحية الأكثر ثقةً في عُمان، ونحتفي بالتراث الغني والجمال الطبيعي للسلطنة.',
    about_v3_title:   'قيمنا',
    about_v3_desc:    'الأصالة والشفافية والمجتمع. نحن نربط الناس لا الأماكن فحسب — وندعم المرشدين المحليين وأسرهم.',
    about_v4_title:   'معتمد وزارياً',
    about_v4_desc:    'كل مرشد يحمل ترخيصاً رسمياً من وزارة التراث والسياحة — ضمانك للجودة والاحترافية.',

    /* ── SEARCH PAGE ── */
    search_all_dest:  'جميع الوجهات',
    search_any_lang:  'أي',
    search_any_rating:'أي',
    search_sort_lbl:  'ترتيب حسب',
    sort_rating:      'التقييم ↓',
    sort_price_asc:   'السعر ↑',
    sort_price_desc:  'السعر ↓',
    filter_min_rating:'أدنى تقييم',
    back_home:        '→ العودة للرئيسية',
    results_found:    (n) => `تم العثور على ${n} مرشد`,
    no_results:       'لا يوجد مرشدون',
    no_results_sub:   'جرّب تعديل الفلاتر أو اختر تاريخاً مختلفاً.',
    clear_filters:    'مسح الفلاتر',
    per_day:          '/يوم',
    view_profile:     'عرض الملف ←',
    reviews_count:    (n) => `${n} مراجعة`,
    rating_lbl:       'التقييم',

    /* ── GUIDE PROFILE ── */
    about:            'نبذة عن المرشد',
    specialisations:  'التخصصات',
    reviews_title:    'مراجعات السياح',
    no_reviews:       'لا توجد مراجعات بعد.',
    verified_lbl:     '✓ معتمد من الوزارة — الترخيص:',
    pending_lbl:      '⏳ في انتظار التحقق',
    book_title:       'طلب حجز',
    tour_date:        'تاريخ الجولة *',
    select_date:      '— اختر تاريخاً متاحاً —',
    duration:         'المدة *',
    full_day:         'يوم كامل',
    half_day:         'نصف يوم (٦٠٪)',
    destination:      'الوجهة',
    select_dest:      '— اختر الوجهة —',
    participants:     'عدد المشاركين',
    special_req:      'طلبات خاصة (اختياري)',
    special_placeholder: 'أي تفضيلات أو ملاحظات للمرشد...',
    price_label:      'السعر',
    total_label:      'الإجمالي',
    book_btn:         'إرسال طلب الحجز',
    book_note:        'سيؤكد المرشد طلبك خلال ٢٤ ساعة.',
    signin_to_book:   'سجّل دخولك لحجز هذا المرشد.',
    only_tourist:     'الحجز متاح لحسابات السياح فقط.',
    guide_not_found:  'المرشد غير موجود',
    back_search:      'العودة للبحث',

    /* ── LOGIN ── */
    login_title:      'أهلاً بعودتك',
    login_sub:        'سجّل دخولك لإدارة حجوزاتك',
    email_lbl:        'البريد الإلكتروني',
    email_ph:         'example@domain.com',
    pass_lbl:         'كلمة المرور',
    pass_ph:          '••••••••',
    login_btn:        'تسجيل الدخول',
    login_loading:    'جارٍ تسجيل الدخول...',
    demo_accounts:    'دخول سريع — حسابات تجريبية',
    no_account:       'ليس لديك حساب؟',
    signup_link:      'إنشاء حساب',

    /* ── REGISTER ── */
    reg_title:        'إنشاء حسابك',
    reg_sub:          'انضم إلى Guideon كسائح أو مرشد معتمد',
    tab_tourist:      '👤 سائح',
    tab_guide:        '🎒 مرشد سياحي معتمد',
    full_name:        'الاسم الكامل *',
    full_name_ph:     'اسمك الكامل',
    email_addr:       'البريد الإلكتروني *',
    pass_req:         'كلمة المرور *',
    pass_ph2:         '٨ أحرف على الأقل',
    phone_lbl:        'رقم الهاتف',
    phone_ph:         '+968 XXXX XXXX',
    nationality:      'الجنسية',
    nat_ph:           'مثال: بريطاني',
    pref_lang:        'اللغة المفضلة',
    guide_note:       'ملاحظة: سيتم مراجعة حسابك والتحقق منه من قِبل المشرف قبل ظهوره في نتائج البحث.',
    licence_lbl:      'رقم الترخيص من الوزارة *',
    licence_ph:       'MOT-YYYY-XXXX',
    price_day:        'السعر باليوم (ريال عُماني) *',
    langs_spoken:     'اللغات المتحدث بها *',
    langs_ph:         'العربية، الإنجليزية، الفرنسية',
    dests_covered:    'الوجهات المغطاة *',
    dests_ph:         'مسقط، نزوى، بهلاء',
    specs_lbl:        'التخصصات *',
    specs_ph:         'المواقع التاريخية، السفاري الصحراوية، الجولات الثقافية',
    bio_lbl:          'نبذة مهنية',
    bio_ph:           'أخبر السياح عن خبرتك وتخصصك...',
    reg_btn:          'إنشاء الحساب',
    reg_loading:      'جارٍ الإنشاء...',
    have_account:     'لديك حساب بالفعل؟',
    signin_link:      'تسجيل الدخول',

    /* ── TOURIST DASHBOARD ── */
    tourist_dash:     'لوحة تحكمي 📋',
    total_bk:         'إجمالي الحجوزات',
    confirmed_bk:     'مؤكدة',
    pending_bk:       'معلقة',
    completed_bk:     'مكتملة',
    tab_all:          'الكل',
    tab_pending:      'معلقة',
    tab_confirmed:    'مؤكدة',
    tab_completed:    'مكتملة',
    tab_cancelled:    'ملغاة',
    find_guides:      '🔍 ابحث عن المزيد من المرشدين',
    no_bookings:      'لا توجد حجوزات',
    no_bookings_sub:  'ابدأ باستكشاف المرشدين لتقديم حجزك الأول!',
    view_guide:       'عرض المرشد',
    write_review:     '✍ كتابة مراجعة',
    cancel_bk:        'إلغاء',
    cancel_confirm:   'هل أنت متأكد من إلغاء هذا الحجز؟\n\nملاحظة: يجب الإلغاء قبل ٤٨ ساعة على الأقل من موعد الجولة.',
    review_title:     'كتابة مراجعة',
    rating_req:       'التقييم',
    review_lbl:       'مراجعتك',
    review_ph:        'شارك تجربتك مع هذا المرشد...',
    cancel_btn:       'إلغاء',
    submit_review:    'إرسال المراجعة',
    rating_required:  'الرجاء اختيار تقييم بالنجوم.',
    half_day_lbl:     'نصف يوم',
    full_day_lbl:     'يوم كامل',
    person_lbl:       'مشارك',
    persons_lbl:      'مشاركون',

    /* ── GUIDE DASHBOARD ── */
    guide_dash:       'لوحة تحكم المرشد',
    total_bk2:        'إجمالي الحجوزات',
    pending_req:      'طلبات معلقة',
    total_earn:       'الأرباح الإجمالية (ريال)',
    avg_rating:       'متوسط التقييم',
    pending_section:  '⏳ طلبات الحجز المعلقة',
    confirmed_section:'✅ الحجوزات المؤكدة القادمة',
    past_section:     '📋 الحجوزات السابقة',
    manage_avail:     '📅 إدارة التوفر',
    avail_note:       'انقر على التواريخ لتفعيل/تعطيل توفرك خلال الـ ٦٠ يوماً القادمة.',
    save_avail:       'حفظ التوفر',
    accept_btn:       '✓ قبول',
    reject_btn:       '✗ رفض',
    no_pending:       'لا توجد طلبات معلقة.',
    no_confirmed:     'لا توجد حجوزات مؤكدة قادمة.',
    no_past:          'لا توجد حجوزات سابقة.',
    accept_confirm:   'قبول هذا الحجز؟',
    reject_confirm:   'رفض هذا الحجز؟',

    /* ── ADMIN ── */
    admin_dash:       'لوحة تحكم المشرف 🛡️',
    admin_panel:      '🛡️ لوحة المشرف',
    total_guides:     'إجمالي المرشدين',
    total_tourists:   'إجمالي السياح',
    total_bookings:   'إجمالي الحجوزات',
    revenue:          'الإيرادات (ريال)',
    tab_pending_g:    '⏳ طلبات الموافقة',
    tab_guides:       '🎒 جميع المرشدين',
    tab_tourists:     '👤 السياح',
    tab_bookings:     '📋 جميع الحجوزات',
    approve_btn:      '✓ موافقة',
    suspend_btn:      'تعليق',
    unsuspend_btn:    'إلغاء التعليق',
    verify_btn:       'توثيق',
    complete_btn:     'تأكيد الإكمال',
    no_pending_g:     'لا توجد طلبات معلقة',
    no_pending_sub:   'تم مراجعة جميع طلبات المرشدين.',
    status_verified:  'موثّق',
    status_suspended: 'معلّق',
    status_pending2:  'معلّق للمراجعة',

    /* ── TOURHQ NEW SECTIONS ── */
    benefits_title:   'لماذا تختار Guideon؟',
    benefit1_title:   'أكبر شبكة مرشدين في عُمان',
    benefit1_desc:    'تواصل مع مرشدين معتمدين من وزارة التراث والسياحة في جميع الوجهات العُمانية الرئيسية.',
    benefit2_title:   'برامج سياحية مخصصة بالكامل',
    benefit2_desc:    'كل جولة مصممة خصيصاً لحجم مجموعتك ولغتك وميزانيتك واهتماماتك.',
    benefit3_title:   'احجز مباشرة مع المرشد المحلي',
    benefit3_desc:    'بدون وسطاء. ادعم المجتمعات المحلية واستمتع بتجارب عُمانية أصيلة.',
    guides_in_city:   'مرشد متاح',
    explore_tours:    'استكشف الجولات ←',
    blog_title:       'نصائح ومقالات السفر في عُمان',
    blog_read:        'اقرأ المزيد ←',
    app_title:        'خطّط رحلتك أينما كنت',
    app_sub:          'تابع حجوزاتك وتواصل مع المرشدين واستكشف عُمان — كل ذلك من هاتفك.',
    app_soon:         'قريباً',
    seen_on:          'كما ظهرنا في',
    payment_accept:   'طرق الدفع الآمنة',
    dark_mode:        'الوضع الداكن',
    light_mode:       'الوضع الفاتح',
    online_exp:       'تجارب عبر الإنترنت',
    online_exp_sub:   'استكشف عُمان افتراضياً مع مرشدينا المعتمدين.',
    popular_tours:    'الجولات الشعبية',
    duration_lbl:     'المدة',
    from_price:       'من',
    group_lbl:        'مجموعة',

    /* ── SUPER GUIDE (TourHQ) ── */
    super_guide:      '⭐ مرشد مميز',
    super_guide_desc: 'مرشد معتمد ذو تقييم عالٍ وتميّز مثبت',

    /* ── CURRENCY ── */
    currency_lbl:     'العملة',

    /* ── PLAN MY TRIP (TourHQ) ── */
    plan_trip_title:  'خطّط رحلتي',
    plan_trip_sub:    'أخبرنا عن رحلة أحلامك — سيضع مرشدونا المعتمدون برنامجاً مخصصاً لك.',
    plan_trip_btn:    '✈️ خطّط رحلتي',
    trip_dest:        'الوجهة',
    trip_from:        'تاريخ البداية',
    trip_to:          'تاريخ النهاية (اختياري)',
    trip_group:       'حجم المجموعة',
    trip_lang:        'اللغة المفضلة',
    trip_spec:        'نوع الجولة',
    trip_budget:      'الميزانية اليومية (ريال)',
    trip_notes:       'ملاحظات وتفضيلات',
    trip_notes_ph:    'أخبر المرشدين عن اهتماماتك واحتياجاتك الخاصة وعدد الأطفال وغير ذلك.',
    trip_submit:      'نشر طلب الرحلة',
    trip_loading:     'جارٍ النشر...',
    trip_posted:      '✅ تم نشر الطلب! سيتواصل معك المرشدون المناسبون قريباً.',
    open_requests:    '✈️ طلبات الرحلة المفتوحة',
    matching_trips:   'طلبات تتطابق مع وجهاتك',
    no_trips:         'لا توجد طلبات رحلة مفتوحة حتى الآن.',
    no_my_trips:      'لم تنشر أي طلبات رحلة بعد.',
    contact_tourist:  'التواصل مع السائح',
    close_request:    'إغلاق الطلب',
    trip_status_open: 'مفتوح',
    trip_status_closed:'مغلق',
    group_size_lbl:   'المجموعة',
    budget_lbl:       'الميزانية',
    trip_dates_lbl:   'التواريخ',

    /* ── DEPOSIT (TourHQ) ── */
    deposit_lbl:      'خيار الدفع',
    deposit_20:       'دفعة مقدمة ٢٠٪',
    deposit_50:       'دفعة مقدمة ٥٠٪',
    deposit_full:     'الدفع الكامل',
    deposit_note:     'يُدفع المبلغ المتبقي للمرشد يوم الجولة.',

    /* ── TRUST SECTION ── */
    trust_guides:     'مرشد معتمد',
    trust_dests:      'وجهة سياحية',
    trust_reviews:    'مراجعة سعيدة',
    trust_since:      'تأسس ٢٠٢٥',

    /* ── WISHLIST ── */
    wishlist_saved:   '❤️ تم الحفظ في المفضلة',
    wishlist_removed: 'تم الإزالة من المفضلة',
    saved_guides:     'المرشدون المحفوظون',
    my_wishlist:      '❤️ قائمتي المفضلة',
    wishlist_empty:   'لا يوجد مرشدون محفوظون بعد.',
    wishlist_empty_sub: 'اضغط على ♡ في بطاقة أي مرشد لحفظه هنا.',
    clear_wishlist:   'مسح الكل',

    /* ── BADGES ── */
    guest_fav:        '⭐ مفضل لدى الضيوف',
    top_rated:        '🏆 الأعلى تقييماً',
    new_guide:        '🆕 جديد',

    /* ── PRICE RANGE ── */
    price_range:      'نطاق السعر (ريال)',
    min_price:        'الحد الأدنى',
    max_price:        'الحد الأقصى',

    /* ── CATEGORIES ── */
    cat_all:          'الكل',
    cat_historical:   'تاريخية',
    cat_desert:       'سفاري صحراوي',
    cat_cultural:     'ثقافية',
    cat_nature:       'طبيعة',
    cat_marine:       'بحرية',
    cat_adventure:    'مغامرة',

    /* ── PARTICIPANTS ── */
    guests_lbl:       'الضيوف',
    guest_singular:   'ضيف',
    guest_plural:     'ضيوف',

    /* ── STATUS ── */
    status_pending:   'معلّق',
    status_confirmed: 'مؤكد',
    status_completed: 'مكتمل',
    status_cancelled: 'ملغى',
    na_lbl:           'غير متاح',
    omr_day:          'ريال',
  }
};

/* ═══════════════════════════════════════════════
   I18N ENGINE
═══════════════════════════════════════════════ */

const I18N = {
  lang: localStorage.getItem('gd_lang') || 'en',

  t(key, ...args) {
    const val = TRANSLATIONS[this.lang][key] || TRANSLATIONS['en'][key] || key;
    return typeof val === 'function' ? val(...args) : val;
  },

  apply() {
    const isAr = this.lang === 'ar';
    document.documentElement.lang = this.lang;
    document.documentElement.dir  = isAr ? 'rtl' : 'ltr';

    // Bootstrap RTL/LTR CSS swap (use media attr — both files pre-downloaded, no flash)
    const bsLtr = document.getElementById('bs-ltr');
    const bsRtl = document.getElementById('bs-rtl');
    if (bsLtr) bsLtr.media = isAr ? 'not all' : '';
    if (bsRtl) bsRtl.media = isAr ? '' : 'not all';

    // Custom font for Arabic
    document.body.style.fontFamily = isAr
      ? "'Segoe UI', 'Cairo', 'Tajawal', system-ui, sans-serif"
      : "'Segoe UI', system-ui, sans-serif";

    // Translate all [data-i18n] elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const t   = TRANSLATIONS[this.lang][key] || TRANSLATIONS['en'][key];
      if (t && typeof t === 'string') el.textContent = t;
    });

    // Translate placeholders
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.getAttribute('data-i18n-ph');
      const t   = TRANSLATIONS[this.lang][key] || TRANSLATIONS['en'][key];
      if (t && typeof t === 'string') el.placeholder = t;
    });

    // Update toggle button
    document.querySelectorAll('.lang-toggle').forEach(btn => {
      btn.textContent = isAr ? '🌐 English' : '🌐 عربي';
    });
  },

  toggle() {
    this.lang = this.lang === 'en' ? 'ar' : 'en';
    localStorage.setItem('gd_lang', this.lang);
    this.apply();
    // Re-render dynamic content if needed
    if (typeof window.onLangChange === 'function') window.onLangChange();
  },

  init() {
    this.apply();
  }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => I18N.init());
