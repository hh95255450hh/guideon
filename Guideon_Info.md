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
| Admin | admin@Guideon.om | Admin123! |
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
