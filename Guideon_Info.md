# Guideon — معلومات المشروع الكاملة
**تاريخ الإنشاء:** 2026-05-17

---

## 🌐 الروابط

| الخدمة | الرابط |
|--------|--------|
| الموقع (Railway) | https://guideon-production.up.railway.app |
| GitHub Repository | https://github.com/hh95255450hh/guideon |
| Supabase Dashboard | https://supabase.com/dashboard/project/uwgkszszsogivhphlfdy |
| Supabase REST API | https://uwgkszszsogivhphlfdy.supabase.co/rest/v1/ |
| Resend Dashboard | https://resend.com/domains |
| Hostinger DNS | https://hpanel.hostinger.com |

---

## 👤 حسابات الدخول

| النوع | الإيميل | الباسورد |
|-------|---------|----------|
| Admin | hh92hh@guideon.om | (غير معروفة — يلزم إعادة تعيين) |
| سائح (James) | tourist@example.com | Password123! |
| سائح (Anna) | anna@example.com | Password123! |
| سائح (Yuki) | yuki@example.com | Password123! |
| مرشد (Mohammed) | mohammed@Guideon.om | Password123! |
| مرشد (Fatima) | fatima@Guideon.om | Password123! |
| مرشد (Khalid) | khalid@Guideon.om | Password123! |
| مرشد (Aisha) | aisha@Guideon.om | Password123! |

---

## 🔑 API Keys & Secrets

| الخدمة | المفتاح |
|--------|---------|
| Supabase URL | https://uwgkszszsogivhphlfdy.supabase.co |
| Supabase Anon Key | sb_publishable_e7f2BmlvGIxIs3Ya1jyKrQ_hqW7X-jM |
| Resend API Key | re_43dnbDNB_C59XJtiSgQcWMvzxQFoac1qi |
| Session Secret | Guideon_Prod_Secret_2025 |

---

## 📧 إعدادات الإيميل (Resend)

**الحالة:** بانتظار التحقق من domain guideon.om

### سجلات DNS المطلوبة في Hostinger

| Type | Name | Value | Priority |
|------|------|-------|----------|
| TXT | `resend._domainkey` | `v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCbuPm7+j+lf2ablc75RnVoYF7Hj1m8XTfCU7TXP1LU05kdExbVCkUf6oOnHHFe2LZTzEnb83lrXDV3rkjKuOP9C0H9RG+dhHHmpZqjeA1qg1oQPu6l0052P+ZapDwV4MiIKomWCKJFloZxV2gFPD8flQIXblis/fF2JflnzebP7QIDAQAB` | - |
| TXT | `@` | `v=spf1 include:amazonses.com ~all` | - |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | - |
| MX | `bounces` | `feedback-smtp.ap-northeast-1.amazonses.com` | 10 |

### إيميلات تُرسَل تلقائياً

| الحدث | المستقبل |
|-------|---------|
| تسجيل سائح جديد | السائح |
| تسجيل مرشد جديد | المرشد + الأدمن |
| إرسال طلب حجز | السائح + المرشد |
| تأكيد الحجز | السائح + المرشد |
| إلغاء الحجز | السائح + المرشد |
| إكمال الجولة | السائح (تذكير بتقييم) |
| إضافة مراجعة | المرشد |
| تحقق من حساب المرشد | المرشد |

---

## 🚀 Railway — متغيرات البيئة

| Key | Value |
|-----|-------|
| NODE_ENV | production |
| PORT | 3000 |
| SESSION_SECRET | Guideon_Prod_Secret_2025 |
| SUPABASE_URL | https://uwgkszszsogivhphlfdy.supabase.co |
| SUPABASE_ANON_KEY | sb_publishable_e7f2BmlvGIxIs3Ya1jyKrQ_hqW7X-jM |
| RESEND_API_KEY | re_43dnbDNB_C59XJtiSgQcWMvzxQFoac1qi |
| EMAIL_FROM | Guideon <noreply@guideon.om> |
| EMAIL_REPLY_TO | info@guideon.om |
| ADMIN_EMAIL | Hh95255450hh@hotmail.com |

> ✅ النطاق guideon.om مُحقَّق في Resend — الإرسال من `noreply@guideon.om` والردود تذهب لـ `info@guideon.om` عبر Cloudflare Routing.

---

## 🗄️ قاعدة البيانات (Supabase)

| الجدول | الوصف |
|--------|-------|
| users | جميع المستخدمين (أدمن، سياح، مرشدين) |
| bookings | الحجوزات |
| reviews | المراجعات |
| trip_requests | طلبات الرحلات |

---

## ✅ آخر التحديثات — 2026-06-12 (لوحة الإيرادات + الإدارة المالية + إصلاح حرج للبحث)

### 🚨 إصلاح حرج: عودة البحث وقوائم الأدمن
تحسين أداء سابق (M1) دفع الترتيب + `count:'exact'` + التقطيع إلى Postgres عبر `SupabaseDB.findPage`، لكنه **أرجع 0 نتيجة على بيانات الإنتاج** — أفرغ بحث المرشدين (`/api/guides`) وكل قوائم الأدمن بصمت.
- **الإصلاح:** الرجوع إلى `findAllWhere`/`readAll` + ترتيب/فلترة/تقطيع في JS (المسار المُجرَّب).
- **الملفّات:** `searchGuides` (commit 6426c9e) + `userPage` للأدمن (commit 47fd720).
- **درس:** أيّ نقل منطق إلى قاعدة البيانات يجب اختباره على بيانات إنتاج حقيقيّة — الاختبارات المحليّة بلا DB لا تكشفه.

### 💰 لوحة تحكّم الإيرادات (`/admin-revenue.html`)
لوحة تحليلات ماليّة احترافيّة (وضع ليلي افتراضي، ApexCharts، متجاوبة):
- **نظرة عامّة:** إجمالي/يومي/أسبوعي/شهري/سنوي + نموّ% + عدد العمليّات + متوسّط قيمة الطلب + أرباح المنصّة + مستحقّات المزوّدين.
- **رسوم:** خطّ زمني (يومي/شهري) + توزيع حسب المصدر (أفراد/شركات) + طرق الدفع.
- **جداول:** أعلى المزوّدين دخلاً + الإيراد حسب الوجهة + سجلّ عمليّات (بحث/فلترة/فرز).
- **تنبيهات ذكيّة:** كشف انخفاض/ارتفاع الإيراد + ضغط فشل الدفع.
- **تصدير:** CSV (مع BOM للعربي) + طباعة PDF.
- **Backend:** `GET /api/admin/revenue` (صلاحيّة `view_analytics`، cache 30s).

### 🏦 الإدارة المالية — المصروفات والرواتب
- جدول `finance_expenses` (migration **037** — يجب تشغيله في Supabase).
- 10 تصنيفات: راتب · خصم · تسويق · تشغيلي · إيجار · برمجيّات · استرداد · دفعة مزوّد · ضرائب · أخرى.
- خانة "شهري متكرّر" للرواتب/الإيجار.
- **صافي الربح** = أرباح المنصّة (العمولة) − المصروفات + هامش%.
- **Endpoints:** `GET/POST/PATCH/DELETE /api/admin/expenses` (صلاحيّة `manage_finance` للكتابة) — كلّها مُسجَّلة في Audit Log.
- صلاحيّة جديدة `manage_finance` (الأدمن + دور Finance).

### ⚡ تحسينات أداء (M3 + M4)
- **M3:** توحيد كود الرسائل المكرّر (~576 سطر) في `public/js/gd-messages.js` المشترك بين الـ3 dashboards.
- **M4a:** تقسيم `i18n.js` (167KB) → core 6KB + 10 ملفّات JSON تُحمَّل حسب اللغة (`public/i18n/*.json`). توفير 57-60% لزوّار الإنجليزيّة/الصينيّة/الروسيّة.
- **M4b:** كل صفحة تحمّل اتّجاه Bootstrap واحد فقط (LTR أو RTL) بدل الاثنين — توفير ~30KB/صفحة.
- **Cache:** الأصول الثابتة (CSS/JS/صور) تُخزَّن سنة كاملة (`immutable`)، HTML يبقى `no-store`.
- الاختبارات: 12 → **46 اختبار**.

### 🇴🇲 تحسينات أخرى
- علم عُمان الرسمي (SVG: خنجر + سيفان) في الـfooter.
- زرّ + بطاقة + تبويب للوصول للوحة الإيرادات في `admin.html`.

### ⚠️ خطوة يدويّة مطلوبة في Supabase
تشغيل migration **037** (`database/migrations/037_finance_expenses.sql`) لتفعيل إضافة المصروفات.

---

## ✅ آخر التحديثات — 2026-05-30 (إصلاح حرج في الحجز والتقييم)

مراجعة شاملة للمنصة وإصلاح خطأين حرجين في تدفق الحجز والتقييم — أعمدة كان التطبيق يكتبها لكنها مفقودة من قاعدة البيانات.

| الخطأ | الأثر قبل الإصلاح | الإصلاح |
|---|---|---|
| جدول `bookings` ينقصه `startedAt`, `completedAt`, `variantName`, `addons` | المرشد لا يقدر يبدأ/ينهي الرحلة · حجوزات الباقات مع إضافات تفشل | دوال مرنة `insertBookingSafe`/`updateBookingSafe` + migration 021 |
| جدول `reviews` ينقصه `packageId`, `touristPhoto` | السائح لا يقدر يرسل أي تقييم (خطأ 500) | دالة مرنة `insertReviewSafe` + migration 022 |

### آلية الحماية
الدوال المرنة تتجاهل الأعمدة الاختيارية تلقائياً عند خطأ schema-cache فيكتمل الحجز/التقييم فوراً حتى قبل تشغيل الترحيل. تبقى كطبقة حماية دائمة ضد أي اختلاف مستقبلي في المخطط.

### ترحيلات جديدة (تم تشغيلها في Supabase ✓)
- `database/migrations/021_booking_lifecycle_columns.sql`
- `database/migrations/022_review_columns.sql`

### مسارات الكتابة الأخرى (فُحصت — سليمة)
التسجيل، إنشاء/تعديل الباقات، تعديل ملف المرشد — جميعها تحتوي على معالجة أخطاء كافية أو أعمدتها موجودة.

---

## ✅ آخر التحديثات — 2026-05-30 (إحصائيات حيّة حقيقية)

استبدال أرقام الصفحة الرئيسية الثابتة (المكتوبة يدوياً) بأرقام حقيقية ديناميكية من قاعدة البيانات.

| البند | التفاصيل |
|---|---|
| **نقطة API جديدة** | `GET /api/stats/public` — عامة بدون تسجيل دخول · كاش 5 دقائق في الذاكرة |
| **ما تحسبه** | مرشدون معتمدون (موثّقون وغير موقوفين) · وجهات مغطّاة (مختلفة عبر المرشدين) · متوسط التقييم الفعلي · سياح أتمّوا حجزاً |
| **الصفحة الرئيسية** | `index.html` يجلب الأرقام حيّاً عبر `loadStats()` مع إبقاء القيم القديمة كاحتياطي عند فشل الاتصال |

### ملفات جديدة
- **Controller:** `statsController.js`
- **Route:** `stats.js` (مربوط في `app.js` على `/api/stats`)

### تغييرات أخرى
- تغيير إيميل الأدمن من `admin@guideon.guide` إلى `hh92hh@guideon.om` (عبر `set-admin-email.js`)
- تحديث `ANDROID_APP_GUIDE.md`: اسم حزمة التطبيق الفعلي `guide.guideon.twa` (مطابق لـ assetlinks.json المنشور)

---

## ✅ آخر التحديثات — 2026-05-22 (ميزات مستوحاة من GetYourGuide/Viator/Airbnb)

8 ميزات جديدة تسد الفجوات مع المنافسين العالميين (GetYourGuide, Viator, Airbnb Experiences, Withlocals, ToursByLocals).

| الميزة | التفاصيل |
|---|---|
| **F1: SEO Suite** | sitemap.xml ديناميكي مع cache · robots.txt · OG/Twitter meta tags · JSON-LD structured data (Organization + Person + TouristTrip) عبر `/js/seo.js` |
| **F2: Tour Packages** | جدول tour_packages كامل · controller + 7 endpoints (list/get/create/update/delete/mine/feature) · صفحة `tour-package.html` تفاعلية مع itinerary وسعر متعدد المستويات (adults/children) |
| **F3: PDF Voucher** | pdfkit مع تصميم احترافي · `GET /api/bookings/:id/voucher` · يتضمن بيانات الحجز + معلومات الاتصال + شروط الإلغاء |
| **F4: Reviews with Photos** | حتى 3 صور لكل مراجعة (Supabase Storage) · helpfulCount field · `POST /api/reviews/upload-photo` |
| **F5: Q&A on guide profile** | جدول guide_questions · ask/answer/byGuide/forMe endpoints · إيميل تنبيه للمرشد · عرض عام للأسئلة المُجاب عنها |
| **F6: Wishlist Sharing** | جدول shared_wishlists · `POST /api/wishlist/share` ينتج رابط مشاركة · صفحة `shared-wishlist.html` |
| **F7: Newsletter** | جدول newsletter_subscribers · subscribe/unsubscribe endpoints · welcome email · popup widget يظهر بعد 8s مع dismiss للأبد عبر localStorage |
| **F8: Multi-tier Pricing** | price_adult + price_child + max_group_size في tour packages · حساب فوري للمجموع · cancellation_policy (flexible/moderate/strict) |

### ملفات جديدة
- **Routes:** `seo.js`, `packages.js`, `qa.js`, `extras.js`
- **Controllers:** `packageController.js`, `qaController.js`, `wishlistController.js`, `newsletterController.js`
- **Services:** `voucherService.js`
- **Frontend:** `tour-package.html`, `shared-wishlist.html`, `js/seo.js`, `js/newsletter.js`, `robots.txt`
- **Migrations:** `004_tour_packages.sql`, `005_reviews_with_photos.sql`

### حزم جديدة
- `pdfkit` لتوليد PDF vouchers

### Migrations يدوية مطلوبة في Supabase
1. `004_tour_packages.sql` — جدول tour_packages + package_availability + إضافة packageId/adultCount/childCount إلى bookings
2. `005_reviews_with_photos.sql` — photos array في reviews + جدول guide_questions + newsletter_subscribers + shared_wishlists

---

## ✅ آخر التحديثات — 2026-05-22 (إنتاج: المراحل 1-4 الكاملة)

ترقية المشروع من "يعمل" إلى **Production-Ready حقيقي**. 4 مراحل، 19 مهمة، حزم جديدة، اختبارات، CI، توثيق كامل.

### المرحلة 1 — الأساسيات الحرجة

| التحديث | التفاصيل |
|---|---|
| **حذف الكود الميت** | حذف 14 ملف + scripts قديمة + Tempcookie + dashboard.html + public/app.js + schema.sql القديم |
| **CORS whitelist** | تضييق origins عبر متغير CORS_ORIGINS بدل origin:true |
| **Rate Limiting** | login (5/15min), register (3/h), password reset (3/h), api (100/min), chat (20/min) |
| **SupabaseDB efficient queries** | findByField, findAllByField, count — SQL مباشر بدل readAll() + filter |
| **Postgres Session Store** | connect-pg-simple — الجلسات تستمر عبر redeploys |
| **Supabase Storage** | كل الصور تُرفع إلى Supabase Storage بدل filesystem |

### المرحلة 2 — تجربة المستخدم الأساسية

| التحديث | التفاصيل |
|---|---|
| **Password Reset Flow** | forgot-password.html + reset-password.html + إيميل احترافي + token expires بساعة |
| **Email Verification** | إيميل تأكيد عند التسجيل + verify-email/:token + resend-verification |
| **Booking Race Condition** | unique index على (guideId, tourDate) WHERE status IN active → معالجة 409 |
| **CSRF Protection** | Origin/Referer check + SameSite=strict في الإنتاج |

### المرحلة 3 — الجاهزية التشغيلية

| التحديث | التفاصيل |
|---|---|
| **Structured Logging** | pino مع redaction للأسرار + httpLogger بمدة الطلب |
| **Health endpoints** | /health/live, /health/ready (DB ping), /health/metrics (memory) |
| **Sentry integration** | اختياري عبر SENTRY_DSN — يتفعّل تلقائياً |
| **Tests** | 12 اختبار يعمل عبر node:test (npm test) |
| **Database indexes** | migration 003 — indexes لـ users/bookings/reviews/messages/trip_requests |
| **API Documentation** | README.md جديد كامل بالـ endpoints والـ env vars |
| **Validator standardization** | express-validator على endpoints المصادقة الحساسة |

### المرحلة 4 — تحسينات الجودة

| التحديث | التفاصيل |
|---|---|
| **req.user middleware** | loadUser middleware يلصق المستخدم على req.user تلقائياً |
| **CI/CD (GitHub Actions)** | .github/workflows/ci.yml — syntax + tests على Node 18 و 20 |
| **Global error handler** | يلتقط الأخطاء، يسجّلها في pino+Sentry، يرد JSON آمن |
| **uncaught handlers** | unhandledRejection + uncaughtException — لا يقع السيرفر صامتاً |

### الحزم الجديدة المُضافة
- @sentry/node, pino, pino-pretty
- (حُذف: connect-flash, docx, jsonwebtoken — كانوا غير مستخدمين)

### Migrations المُضافة (يجب تطبيقها في Supabase)
1. `database/migrations/002_booking_unique_constraint.sql`
2. `database/migrations/003_performance_indexes.sql`

### متطلبات .env الجديدة (اختيارية لكن مُوصى بها)
- `SENTRY_DSN` — مجاني من sentry.io (5K errors/شهر)
- `CORS_ORIGINS` — قائمة origins مفصولة بفواصل
- `SUPABASE_STORAGE_BUCKET` — اسم الـ bucket (افتراضي: media)
- `LOG_LEVEL` — info/debug/warn/error

### ⚠️ خطوات يدوية بعد النشر
1. **في Supabase Dashboard:** أنشئ Storage bucket باسم `media` واجعله Public
2. **في Supabase SQL Editor:** شغّل migration 002 و 003
3. **في Railway env vars:** أضف `CORS_ORIGINS` و `SENTRY_DSN` (اختياري)
4. **استبدل Stripe keys الـ placeholder** بمفاتيح حقيقية لتفعيل الدفع

---

## ✅ آخر التحديثات — 2026-05-22 (إصلاح أخطاء حرجة)

| التغيير | التفاصيل |
|---------|---------|
| **حذف الكود الميت** | حذف 3 controllers + 3 routes + 2 middleware + uploadService + notificationService + FileDB + config/database.js (كانت تستخدم نظام JWT + pg مختلف وغير مربوطة في app.js) |
| **إصلاح منطق الدفع** | paymentController.js: استخدام حقل isPaid بدل status لتحديد "تم الدفع" — الآن المرشد يمكنه تأكيد الحجز قبل الدفع دون كسر مسار الدفع |
| **إعادة التاريخ عند الإلغاء** | bookingController.js: عند إلغاء الحجز، التاريخ يُعاد إلى توفر المرشد (كما يَعِد إيميل الإلغاء) |
| **SupabaseDB.findById** | استخدام this.pk بدل القيم المُرمزة (id/reviewId) — يدعم الآن أي مفتاح أساسي مخصص |
| **إزالة المفاتيح المكشوفة** | config/supabase.js: حذف Supabase URL والمفتاح المُرمَزَين كـ fallback — الآن يرمي خطأ إذا غاب env |
| **try-catch في authController** | إضافة try-catch للدوال: updateProfile, changePassword, uploadPhoto, saveFcmToken (كانت تسبب unhandled rejections) |
| **حذف الجلب المضاعف** | bookingController.updateStatus: إزالة استعلام مرشد مكرر داخل بلوك confirmed |
| **حذف webhook مكرر** | routes/payments.js: حذف تسجيل /webhook المكرر — الأصلي مُسجّل في app.js مع express.raw() |
| **إصلاح seed script** | package.json: تصحيح "scripts/seed.js" → "scripts/seed_supabase.js" |

---

## ✅ آخر التحديثات — 2026-05-21 (تحديث 3)

| التغيير | التفاصيل |
|---------|---------|
| i18n كامل — جميع الصفحات | i18n.js v16: ~50 مفتاح جديد + ترجمة عربية لجميع العناصر الجديدة |
| guide-profile.html | كل النصوص الثابتة والديناميكية تدعم العربية/الإنجليزية عبر I18N.t() و data-i18n |
| company-dashboard.html | لوحة التحكم كاملة بالعربية مع window.onLangChange |
| admin.html | جدول المرشدين والشركات والسياح والحجوزات يتحول مع اللغة |
| admin.html + adminController.js | دعم الشركات + المرشدين غير المرخصين في لوحة الأدمن |
| company-dashboard.html | لوحة تحكم الشركات: ملف الشركة، الحزم السياحية، إدارة كاملة |
| guide-profile.html | صفحة ملف المرشد الكاملة للسياح: تقويم، حجز، مراجعات، ودية/مشاركة |
| emailService.js | إيميلات الترحيب والموافقة للشركات |
| authController.js | دعم تسجيل الشركات + isMinistryLicensed للمرشدين |
| **رفع الصور والفيديو** | src/routes/upload.js: POST /photo /gallery DELETE /gallery POST /video |
| guide-dashboard.html | انقر الأفاتار لتغيير الصورة + معرض صور (8 صور) + رابط YouTube |
| company-dashboard.html | انقر الشعار لتغيير الصورة + معرض صور + رابط YouTube في وضع التعديل |
| guide-profile.html | عرض معرض الصور + فيديو YouTube مضمّن في الصفحة العامة |
| إلغاء الموقع الإلكتروني للشركات | حذف companyWebsite من register.html + company-dashboard.html + authController.js |
| i18n v17 | مفاتيح gallery_* و video_* و photo_* بالعربية والإنجليزية |
| **الدردشة المباشرة بين السائح والمرشد** | جدول messages في Supabase + API كامل (send/thread/conversations/unread-count) |
| tourist-dashboard.html | قسم رسائل مع قائمة المحادثات + خيط رسائل + تحديث تلقائي كل 9 ثوانٍ |
| guide-dashboard.html | نفس قسم الرسائل للمرشد للرد على الرسائل |
| guide-profile.html | بطاقة "مراسلة المرشد" للسياح مع خيط رسائل مضمّن في الصفحة |
| i18n v18 | مفاتيح msg_* بالعربية والإنجليزية (18 مفتاح جديد) |

---

## 📁 هيكل المشروع

```
GUIDEON/
├── public/              ← الواجهة الأمامية (HTML, CSS, JS)
├── src/
│   ├── app.js           ← نقطة البداية
│   ├── config/
│   │   └── supabase.js  ← إعداد Supabase
│   ├── controllers/     ← منطق API
│   ├── models/
│   │   └── SupabaseDB.js ← نموذج قاعدة البيانات
│   ├── routes/          ← مسارات API
│   └── services/
│       └── emailService.js ← خدمة الإيميلات
├── scripts/
│   └── seed_supabase.js ← نقل البيانات
├── .env                 ← متغيرات البيئة (محلي)
└── ecosystem.config.js  ← إعداد PM2
```

---

## 🛠️ تشغيل المشروع محلياً

```bash
cd C:\Users\hh952\OneDrive\Desktop\oman\GUIDEON
node src/app.js
# الموقع: http://localhost:3000
```

## 📤 نشر تحديث جديد

```bash
cd C:\Users\hh952\OneDrive\Desktop\oman\GUIDEON
git add -A
git commit -m "وصف التغيير"
git push origin main
# Railway ينشر تلقائياً بعد الـ push
```

---

## 📱 المشروع

- **الاسم:** Guideon
- **الوصف:** منصة حجز مرشدين سياحيين معتمدين في سلطنة عُمان
- **GitHub:** hh95255450hh
- **الإيميل:** Hh95255450hh@hotmail.com
- **Domain:** guideon.om

---

## 📱 تطبيق الجوال الرسمي (Flutter — Android + iOS)

- **المصدر:** `mobile/` (Flutter، التطبيق يتّصل بـ`https://guideon.om`).
- **مُعرّف التطبيق:** `om.guideon.guideon` (موحّد للمنصّتين).
- **البناء السحابي:** Codemagic (`codemagic.yaml`) — 3 مسارات:
  - `android-test` → APK تجريبي فوري (بلا إعداد).
  - `android-play` → AAB لمتجر Google Play (يحتاج مجموعة `keystore_credentials`).
  - `ios-release` → IPA لمتجر Apple (يحتاج تكامل App Store Connect — بلا Mac).
- **الأيقونة + شاشة الإطلاق:** تُولَّد في البناء من شعار Guideon
  (`flutter_launcher_icons` + `flutter_native_splash`).
- **الإشعارات:** Firebase Cloud Messaging — الكود جاهز (`PushService`)، يُفعَّل
  تلقائيّاً بعد إضافة `google-services.json` / `GoogleService-Info.plist`
  (انظر `mobile/FIREBASE_SETUP.md`). الخادم يخزّن الرمز عبر `POST /auth/fcm-token`.
- **بيانات المتجر:** `mobile/STORE_LISTING.md` (وصف عربي/إنجليزي + روابط الخصوصية).
- **نوع حساب المطوّر:** مؤسّسة باسم "الرؤية للفكر الرقمي" (D-U-N-S 850403864).

---

## 🔧 مراجعة آليّة الحجز (043) — 2026-06-21

تدقيق عميق لمنطق الحجز/التوقيت كشف وأصلح:
- **القيد الفريد كان `(guideId, tourDate)`** → حجز واحد فقط لكل مزوّد/تاريخ، ما
  عطّل **تعدّد حجوزات الشركات** و**الرحلات الجماعية** و**عدّة فترات/فتحات في
  اليوم**. استُبدل بفهارس backstop للمرشد الفردي فقط (عمود جديد
  `bookings.providerType`)؛ الشركات والباقات تُحكَم بمنطق السعة في التطبيق.
- **رفض التواريخ الماضية وغير الصالحة** عند إنشاء الحجز.
- **منع بيع الباقة فوق `max_group_size`** (جمع المقاعد عبر الحجوزات).
- **توقيت عُمان (UTC+4)** لحسابات "اليوم" و48 ساعة وبدء الرحلة، وآمن ضد NaN.
- migration **043** مُطبّقة على الإنتاج؛ 59 اختباراً ناجحاً.

---

## 🛡️ تدقيق أمني شامل — 2026-06-22

فحص هندسي عميق للمنصّة كاملة. **أُصلح ونُشر:**
- **تجاوز دفع (Thawani):** ربط الجلسة بالحجز (`client_reference_id` + مطابقة المبلغ) في verify/webhook.
- **منع حجز المرشد لنفسه** (تضخيم حجوزات/تقييم وهمي).
- **سباق السعة المتزامنة للشركات:** مصالحة حتميّة بعد الإدراج (`bookingsWithinCapacity`).
- **توحيد نظامَي التوفّر:** مرشد الفتحات يُحجز عبر الفتحات فقط (لا حجز مزدوج).

**فُحص ووُجد محصّناً:** حقن PostgREST/SQL (supabase-js مُعامَل)، RBAC الإداري، ملكيّة
الموارد (IDOR)، القوائم البيضاء، قصّ العمولة/VAT، الجلسة/الكوكيز/HSTS، حدود المعدّل،
التقييمات (حجز مكتمل + واحد)، رفع الملفّات (WebP + قائمة بيضاء + SVG→octet-stream)،
تكلفة الذكاء (حدّ IP)، ولا أسرار في المستودع. 62 اختباراً ناجحاً.

---

## 🖥️ تدقيق الخادم والعمليّات — 2026-06-22

**أُصلح ونُشر على الخادم:**
- **الجدار الناري:** منفذا Postgres (5432/6543) كانا منشورَين على `0.0.0.0` بلا حظر
  (Docker يتجاوز UFW). أُضيفا إلى قاعدة DROP في DOCKER-USER مع
  `guideon-firewall.service` — الآن 22/80/443 فقط مكشوفة خارجيّاً (لا IPv6 عام).
- **النسخ الاحتياطي:** كان يحفظ `public` فقط؛ صار يشمل مخطّط `storage` **وصور
  التخزين الفعليّة** (٣٢٩ ميغا) يوميّاً ٠٢:٣٠، احتفاظ ١٤ يوماً.
- **سجلّات Docker:** كانت غير محدودة؛ ضُبط التدوير (10m×3) عبر daemon.json.
- نسخ مرجعيّة للسكربتات في `deploy/ops/`.

**سليم:** إعادة التشغيل التلقائي (`unless-stopped`)، Swap، تجديد TLS اليومي.

**الفجوة المتبقّية (تحتاج قرارك):** النسخ الاحتياطي **محليّ على نفس الخادم** — لا
نسخة خارجيّة (offsite). يُوصى بـrclone إلى S3/Backblaze/Drive أو scp لخادم آخر.

---

## 🔬 تدقيق المناطق المتبقّية — 2026-06-22

- **المصادقة:** رموز ٢٥٦-بت، bcrypt، تجديد جلسة، رسالة موحّدة، إعادة تعيين بلا
  تسريب، Google يُتحقّق خادميّاً، 2FA (TOTP window 1 + رموز نسخ تُستهلك + حدّ
  محاولات). **أُصلح:** تسريب توقيت عند الدخول لبريد غير موجود (bcrypt وهمي).
- **الحسابات المالية:** الخزانة متّسقة (عمولة المدفوع فقط + توازن صحيح + تقريب
  ٣ خانات)، المصروفات بموجب فقط، تدقيق مُسجَّل. سليمة.
- **SSE:** البثّ خلف `requireLogin`. **XSS الواجهة:** كل المحتوى عبر
  `escHtml`/`gdSafeUrl`. **البريد:** Resend API (لا حقن ترويسات). **SEO:** robots +
  sitemap سليمة. **المكتبات:** ١٩ ثغرة متوسّطة في أدوات الرصد فقط (خطر منخفض).
