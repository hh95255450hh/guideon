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
| EMAIL_FROM | Guideon <onboarding@resend.dev> |
| ADMIN_EMAIL | Hh95255450hh@hotmail.com |

> بعد التحقق من guideon.om في Resend، غيّر EMAIL_FROM إلى: `Guideon <noreply@guideon.om>`

---

## 🗄️ قاعدة البيانات (Supabase)

| الجدول | الوصف |
|--------|-------|
| users | جميع المستخدمين (أدمن، سياح، مرشدين) |
| bookings | الحجوزات |
| reviews | المراجعات |
| trip_requests | طلبات الرحلات |

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
