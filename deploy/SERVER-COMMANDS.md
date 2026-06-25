# أوامر تشغيل Guideon على خادم عُمان داتا بارك

> شغّلها بعد الدخول للخادم كـ root. كلّ "مرحلة" = كتلة تنسخها وتلصقها.
> الأجزاء التي تحتاج تعديل قيم موضّحة بـ ⚠️.

## المرحلة ١ — تثبيت Docker
```bash
curl -fsSL https://get.docker.com | sh
docker --version
```

## المرحلة ٢ — تشغيل Supabase الذاتي
```bash
mkdir -p /opt && cd /opt
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
docker compose pull
docker compose up -d
```
- بعد دقيقة، تأكّد: `docker compose ps` (كلّها Up).
- Supabase صار متاحاً محليّاً على المنفذ 8000.
- ⚠️ المفاتيح الافتراضيّة في `.env` تعمل للبداية — **غيّرها لاحقاً للأمان** (POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY).
- خذ نسخة من قيم `ANON_KEY` و `SERVICE_ROLE_KEY` من الملفّ:
```bash
grep -E "ANON_KEY|SERVICE_ROLE_KEY" /opt/supabase/docker/.env
```

## المرحلة ٣ — جلب تطبيق Guideon
```bash
cd /opt
git clone https://github.com/hh95255450hh/guideon
cd guideon/deploy
cp .env.production.example .env
nano .env
```
⚠️ في `nano` عدّل هذه القيم ثم احفظ (Ctrl+O، Enter، Ctrl+X):
```
SUPABASE_URL=http://host.docker.internal:8000
SUPABASE_SERVICE_ROLE_KEY=<الصق SERVICE_ROLE_KEY من المرحلة ٢>
SUPABASE_ANON_KEY=<الصق ANON_KEY من المرحلة ٢>
SESSION_SECRET=<أي نصّ عشوائي طويل>
RESEND_API_KEY=<مفتاح Resend>
```

## المرحلة ٤ — نشر التطبيق
```bash
cd /opt/guideon/deploy
docker compose up -d --build
docker compose logs -f app
```
- التطبيق يعمل على المنفذ 3000 (خلف Nginx).

## المرحلة ٥ — استيراد بياناتك (يتطلّب Supabase القديم مفعّلاً)
على جهازك (وليس الخادم)، صدّر أوّلاً:
```bash
# قاعدة البيانات (من رابط Supabase القديم)
pg_dump "<connection-string>" --no-owner --no-acl -Fc -f guideon-db.dump
```
ثم انقل `guideon-db.dump` للخادم واستورده:
```bash
# على الخادم
pg_restore --no-owner --no-acl -d "postgresql://postgres:<PASS>@localhost:5432/postgres" guideon-db.dump
```
الصور: استخدم `deploy/migrate-storage.js` لتصديرها ثم ارفعها للـ bucket باسم `media`.

## المرحلة ٦ — شهادة HTTPS + النطاق
```bash
cd /opt/guideon/deploy
mkdir -p certbot/conf certbot/www
docker run --rm -v $PWD/certbot/conf:/etc/letsencrypt -v $PWD/certbot/www:/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot -d guideon.om -d www.guideon.om
docker compose restart nginx
```
ثم وجّه DNS: سجلّ A لـ `guideon.om` → `185.64.25.111`.

## التحقّق
```bash
curl -I http://localhost:3000/health
docker compose ps
```
افتح https://guideon.om → تظهر المنصّة بالبيانات.

---
> 💡 الأجزاء المعقّدة (مفاتيح Supabase، تعديل .env، استيراد البيانات) أسهل بكثير لو أتولّاها أنا عبر SSH بعد إضافة مفتاحي. لكن هذه الأوامر تتيح لك تنفيذها بنفسك خطوة بخطوة.
