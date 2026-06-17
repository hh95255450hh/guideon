# دليل نقل منصّة Guideon إلى عُمان داتا بارك 🇴🇲

> الهدف: نقل المنصّة (التطبيق + قاعدة البيانات + التخزين) إلى خادم **داخل سلطنة عُمان** —
> لحلّ السرعة، وتحقيق شرط الوزارة (البيانات داخل عُمان)، والتخلّص من حصص Supabase نهائيّاً.

## الفكرة الأساسيّة (مهمّة)

المنصّة تتّصل بـ Supabase عبر مكتبة `@supabase/supabase-js`. لذلك أنظف طريقة نقل هي
**تشغيل Supabase ذاتيّاً (Self-Hosted) على خادم عُمان** — فيبقى **كلّ الكود يعمل بلا تغيير**،
ونغيّر فقط عنوان `SUPABASE_URL` ومفاتيحه. لا إعادة كتابة، لا مخاطرة.

```
سنغافورة (الآن)                      عُمان داتا بارك (بعد النقل)
┌────────────────┐                  ┌──────────────────────────────────┐
│ Railway: التطبيق│                  │ خادم Ubuntu واحد داخل عُمان:       │
│ Supabase السحابي│   ──── ننقل ──▶  │  • Guideon (Docker)              │
│ (قاعدة + تخزين) │                  │  • Supabase ذاتي (Postgres+تخزين)│
└────────────────┘                  │  • Nginx (HTTPS)                 │
                                    └──────────────────────────────────┘
```

---

## ما تحتاج شراءه من عُمان داتا بارك

**خادم سحابي / VPS** (وليس استضافة ويب مشتركة):
- نظام: **Ubuntu 22.04 LTS**
- المعالج: 2–4 vCPU
- الذاكرة: **8 GB RAM** (الحدّ الأدنى الموصى به لتشغيل Supabase + التطبيق)
- التخزين: **100 GB SSD** أو أكثر (حسب حجم الصور)
- وصول: **SSH / Root** كامل
- داخل **مركز بيانات عُمان** ✅

> العقد الذي ستحصل عليه = "عقد الاستضافة السحابيّة" المطلوب في نموذج الوزارة.

---

## الخطوات

### ١. تجهيز الخادم
```bash
ssh root@<عنوان-الخادم>
apt update && apt upgrade -y
# تثبيت Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin git
```

### ٢. (مهمّ أوّلاً) تصدير البيانات من Supabase السحابي
> ⚠️ يتطلّب أن يكون مشروع Supabase **مُفعّلاً** (حُلّت الحصّة/الفاتورة) لتتمكّن من القراءة والتصدير.
> صدّر أوّلاً، ثم تابع النقل.

**أ) قاعدة البيانات** (من جهازك أو الخادم):
```bash
# رابط الاتصال من: Supabase → Project Settings → Database → Connection string
pg_dump "postgresql://postgres:<PASS>@db.<ref>.supabase.co:5432/postgres" \
  --no-owner --no-acl -Fc -f guideon-db.dump
```

**ب) ملفّات التخزين (الصور):** استخدم سكربت `migrate-storage.js` المرفق (يحمّل كلّ
الملفّات من Supabase Storage إلى مجلّد محلي)، أو انسخها لاحقاً إلى التخزين الذاتي.

### ٣. تشغيل Supabase ذاتيّاً على الخادم
```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# عدّل .env: غيّر POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY,
#            SITE_URL, وكلمات مرور Studio. (وثّق المفاتيح المُولّدة)
docker compose up -d
```
بهذا يعمل Supabase محليّاً (REST + Storage + Postgres) على المنفذ 8000.

### ٤. استيراد البيانات إلى Supabase الذاتي
```bash
# قاعدة البيانات
pg_restore --no-owner --no-acl -d "postgresql://postgres:<PASS>@localhost:5432/postgres" guideon-db.dump
# التخزين: ارفع الصور للـ bucket المسمّى media (عبر Studio أو سكربت الرفع)
```

### ٥. نشر تطبيق Guideon
```bash
git clone <رابط-مستودعك> guideon && cd guideon/deploy
cp .env.production.example .env
# عدّل .env: ضع مفاتيح Supabase الذاتي (من الخطوة ٣) + RESEND + SESSION_SECRET ...
docker compose up -d --build
```

### ٦. الشهادة والنطاق
```bash
# إصدار شهادة TLS مجّانيّة (Let's Encrypt)
docker run --rm -v $PWD/certbot/conf:/etc/letsencrypt -v $PWD/certbot/www:/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot -d guideon.om -d www.guideon.om
docker compose restart nginx
```
ثم وجّه **DNS** للنطاق `guideon.om` إلى عنوان IP للخادم العُماني.

### ٧. التحقّق
- افتح https://guideon.om → تظهر المرشدون والصور.
- جرّب تسجيل دخول، حجز، رفع صورة.
- تأكّد من النسخ الاحتياطي الدوري (انظر أدناه).

---

## النسخ الاحتياطي (بعد النقل)
أضف مهمّة cron يوميّة:
```bash
# /etc/cron.daily/guideon-backup
pg_dump "postgresql://postgres:<PASS>@localhost:5432/postgres" -Fc \
  -f /backups/guideon-$(date +%F).dump
# (واحتفظ بنسخة من مجلّد التخزين أيضاً)
```

---

## ملاحظات
- **لا تغيير في كود التطبيق** — فقط متغيّرات البيئة (`SUPABASE_URL` + المفاتيح).
- استبعدنا ميزات الذكاء الاصطناعي افتراضيّاً (`ANTHROPIC_API_KEY` فارغ) — فعّلها لاحقاً إن رغبت.
- للأداء العالي مستقبلاً يمكن فصل قاعدة البيانات على خادم مستقلّ، لكن خادم واحد يكفي للبداية.

> أنا (مهندس المنصّة) جاهز لمساعدتك في كلّ خطوة عند توفّر الخادم — خصوصاً ضبط `.env`
> واستيراد البيانات والتحقّق النهائي.
