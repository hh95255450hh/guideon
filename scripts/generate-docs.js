require('dotenv').config();
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  PageBreak, Header, Footer,
} = require('docx');
const fs = require('fs');
const path = require('path');

// ── Helpers ───────────────────────────────────────────────────────────────────
const GREEN  = '1a6b4a';
const GOLD   = 'f0a500';
const DARK   = '1a1a1a';
const GRAY   = '555555';
const LGRAY  = 'f2f2f2';

const h1 = (text) => new Paragraph({
  text,
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 400, after: 200 },
  children: [new TextRun({ text, bold: true, size: 36, color: GREEN })],
});

const h2 = (text) => new Paragraph({
  text,
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 300, after: 150 },
  children: [new TextRun({ text, bold: true, size: 28, color: DARK })],
});

const h3 = (text) => new Paragraph({
  spacing: { before: 200, after: 100 },
  children: [new TextRun({ text, bold: true, size: 24, color: GREEN })],
});

const p = (text, opts = {}) => new Paragraph({
  spacing: { before: 80, after: 80 },
  children: [new TextRun({ text, size: 22, color: GRAY, ...opts })],
});

const bullet = (text) => new Paragraph({
  bullet: { level: 0 },
  spacing: { before: 60, after: 60 },
  children: [new TextRun({ text, size: 22, color: DARK })],
});

const code = (text) => new Paragraph({
  spacing: { before: 60, after: 60 },
  shading: { type: ShadingType.SOLID, color: LGRAY },
  children: [new TextRun({ text, font: 'Courier New', size: 20, color: '333333' })],
});

const divider = () => new Paragraph({
  spacing: { before: 200, after: 200 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'dddddd' } },
  children: [],
});

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const kv = (key, value) => new Paragraph({
  spacing: { before: 60, after: 60 },
  children: [
    new TextRun({ text: `${key}: `, bold: true, size: 22, color: DARK }),
    new TextRun({ text: value, size: 22, color: GRAY, font: 'Courier New' }),
  ],
});

const tableRow = (cells, isHeader = false) => new TableRow({
  tableHeader: isHeader,
  children: cells.map((text, i) => new TableCell({
    shading: isHeader ? { type: ShadingType.SOLID, color: GREEN }
             : i % 2 === 0 ? { type: ShadingType.CLEAR, color: 'FFFFFF' }
             : { type: ShadingType.SOLID, color: 'f9f9f9' },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      children: [new TextRun({
        text: String(text ?? ''),
        size: 20,
        color: isHeader ? 'FFFFFF' : DARK,
        bold: isHeader,
      })],
    })],
  })),
});

const table = (headers, rows) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  margins: { top: 80, bottom: 80 },
  rows: [
    tableRow(headers, true),
    ...rows.map(r => tableRow(r)),
  ],
});

// ── Document ──────────────────────────────────────────────────────────────────
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: 'Segoe UI', size: 22, color: DARK },
      },
    },
  },
  sections: [{
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: '🌴 GUIDEON – Project Documentation', size: 18, color: '999999' })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'GUIDEON – Confidential Project Documentation', size: 18, color: '999999' })],
        })],
      }),
    },
    children: [

      // ── COVER ──────────────────────────────────────────────────────────────
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1200, after: 400 },
        children: [new TextRun({ text: '🌴 GUIDEON', bold: true, size: 72, color: GREEN })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: 'Tourism Marketplace Platform', size: 36, color: GRAY })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: 'Full Project Documentation', size: 28, color: '888888' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}`, size: 22, color: '999999' })],
      }),
      divider(),

      // ── 1. PROJECT OVERVIEW ────────────────────────────────────────────────
      pageBreak(),
      h1('1. Project Overview'),
      p('GUIDEON is a production-ready Node.js + PostgreSQL REST API for a tourism marketplace platform targeting the Sultanate of Oman. It handles tour listings, bookings, Stripe payments, email notifications, Firebase push notifications, and an AI-powered tourism chatbot.'),
      divider(),

      h2('Tech Stack'),
      table(
        ['Layer', 'Technology'],
        [
          ['Runtime',        'Node.js 18+'],
          ['Framework',      'Express.js 4'],
          ['Database',       'PostgreSQL 14+'],
          ['Authentication', 'JWT (Access 7d + Refresh 30d)'],
          ['Payments',       'Stripe (Payment Intents + Webhooks)'],
          ['Email',          'Resend API'],
          ['Push Notifications', 'Firebase Admin SDK (FCM)'],
          ['AI Chatbot',     'OpenAI GPT-4o-mini'],
          ['Security',       'Helmet, CORS, bcrypt, Rate Limiting'],
          ['File Uploads',   'Multer'],
        ]
      ),

      divider(),
      h2('Project Location'),
      code('C:\\Users\\hh952\\OneDrive\\Desktop\\oman\\GUIDEON'),

      divider(),
      h2('User Roles'),
      table(
        ['Role', 'Capabilities'],
        [
          ['tourist',  'Browse tours, make bookings, write reviews, cancel bookings'],
          ['guide',    'Assigned to tours by companies'],
          ['company',  'Create & manage tours, view own company bookings'],
          ['admin',    'Full access: users, tours, bookings, stats, refunds'],
        ]
      ),

      // ── 2. RUNNING LOCALLY ────────────────────────────────────────────────
      pageBreak(),
      h1('2. Running Locally'),
      h2('Start the Server'),
      code('cd C:\\Users\\hh952\\OneDrive\\Desktop\\oman\\GUIDEON'),
      code('node src/app.js'),
      p('Server runs at: http://localhost:3000'),
      p(''),
      h2('Development Mode (auto-restart)'),
      code('npm run dev'),

      divider(),
      h2('Useful URLs (Local)'),
      table(
        ['Page', 'URL'],
        [
          ['Health Check',      'http://localhost:3000/health'],
          ['API Overview',      'http://localhost:3000/api'],
          ['Website / Chatbot', 'http://localhost:3000'],
          ['Checkout Page',     'http://localhost:3000/checkout.html'],
        ]
      ),

      divider(),
      h2('Database Migration (first run)'),
      code('node -e "require(\'dotenv\').config(); const {Pool}=require(\'pg\'); const p=new Pool({host:process.env.DB_HOST,port:process.env.DB_PORT,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD}); p.query(\'ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT\').then(()=>console.log(\'Done\')).catch(console.error)"'),

      // ── 3. ENVIRONMENT VARIABLES ──────────────────────────────────────────
      pageBreak(),
      h1('3. Environment Variables (.env)'),
      p('File location: C:\\Users\\hh952\\OneDrive\\Desktop\\oman\\GUIDEON\\.env'),
      divider(),

      h2('Server'),
      kv('PORT',     '3000'),
      kv('NODE_ENV', 'development'),

      divider(),
      h2('Database'),
      kv('DB_HOST',     'localhost'),
      kv('DB_PORT',     '5432'),
      kv('DB_NAME',     'oman_explorer'),
      kv('DB_USER',     'postgres'),
      kv('DB_PASSWORD', 'postgres'),

      divider(),
      h2('JWT Secrets'),
      kv('JWT_SECRET',             'oman_explorer_jwt_secret_dev_2024_change_in_prod'),
      kv('JWT_EXPIRES_IN',         '7d'),
      kv('JWT_REFRESH_SECRET',     'oman_explorer_refresh_secret_dev_2024_change_in_prod'),
      kv('JWT_REFRESH_EXPIRES_IN', '30d'),

      divider(),
      h2('Stripe'),
      kv('STRIPE_SECRET_KEY',      'sk_test_placeholder_replace_with_real_key'),
      kv('STRIPE_WEBHOOK_SECRET',  'whsec_placeholder_replace_with_real_secret'),

      divider(),
      h2('Resend Email'),
      kv('RESEND_API_KEY', 're_43dnbDNB_C59XJtiSgQcWMvzxQFoac1qi'),
      kv('EMAIL_FROM',     'GUIDEON <onboarding@resend.dev>'),

      divider(),
      h2('OpenAI'),
      kv('OPENAI_API_KEY', 'sk-proj-REPLACE_WITH_YOUR_OPENAI_KEY'),

      divider(),
      h2('Firebase'),
      kv('FIREBASE_PROJECT_ID',  'REPLACE_WITH_YOUR_PROJECT_ID'),
      kv('FIREBASE_CLIENT_EMAIL','REPLACE_WITH_YOUR_CLIENT_EMAIL'),
      kv('FIREBASE_PRIVATE_KEY', 'REPLACE_WITH_YOUR_PRIVATE_KEY'),

      divider(),
      h2('URLs'),
      kv('APP_URL',    'http://localhost:3000'),
      kv('CLIENT_URL', 'http://localhost:5173'),

      // ── 4. API ENDPOINTS ──────────────────────────────────────────────────
      pageBreak(),
      h1('4. API Endpoints'),

      h2('Auth  —  /api/auth'),
      table(
        ['Method', 'Endpoint', 'Auth Required', 'Description'],
        [
          ['POST', '/api/auth/register', 'No',  'Register new user'],
          ['POST', '/api/auth/login',    'No',  'Login → returns accessToken + refreshToken'],
          ['POST', '/api/auth/refresh',  'No',  'Refresh access token'],
          ['POST', '/api/auth/logout',   'Yes', 'Logout (invalidates refresh token)'],
          ['GET',  '/api/auth/me',       'Yes', 'Get current user profile'],
        ]
      ),

      divider(),
      h2('Tours  —  /api/tours'),
      table(
        ['Method', 'Endpoint', 'Auth Required', 'Description'],
        [
          ['GET',    '/api/tours',              'No',           'List all tours (with filters)'],
          ['GET',    '/api/tours/:id',           'No',           'Tour detail + availability'],
          ['POST',   '/api/tours',              'company/admin','Create new tour'],
          ['PUT',    '/api/tours/:id',           'company/admin','Update tour'],
          ['DELETE', '/api/tours/:id',           'admin',        'Delete tour'],
          ['POST',   '/api/tours/:id/images',    'company/admin','Upload tour image'],
          ['GET',    '/api/tours/:id/reviews',   'No',           'Tour reviews & rating stats'],
        ]
      ),
      p('Filter params: ?category=Desert&region=Al+Sharqiyah&minPrice=50&maxPrice=300&difficulty=moderate&minRating=4&search=wadi&sortBy=price&sortOrder=ASC&page=1&limit=12'),

      divider(),
      h2('Bookings  —  /api/bookings'),
      table(
        ['Method', 'Endpoint', 'Auth Required', 'Description'],
        [
          ['POST',  '/api/bookings',              'tourist',       'Create booking (locks availability)'],
          ['GET',   '/api/bookings',              'Yes',           'List bookings (own for tourist, all for admin)'],
          ['GET',   '/api/bookings/:id',          'Yes',           'Get single booking detail'],
          ['PATCH', '/api/bookings/:id/cancel',   'Yes',           'Cancel booking (restores spots)'],
          ['PATCH', '/api/bookings/:id/status',   'admin/company', 'Update booking status'],
        ]
      ),

      divider(),
      h2('Payments  —  /api/payments'),
      table(
        ['Method', 'Endpoint', 'Auth Required', 'Description'],
        [
          ['POST', '/api/payments/create-intent', 'Yes',   'Create Stripe Payment Intent → returns clientSecret'],
          ['GET',  '/api/payments/status/:id',    'Yes',   'Get payment status for a booking'],
          ['POST', '/api/payments/webhook',       'None',  'Stripe webhook handler (raw body)'],
          ['POST', '/api/payments/refund',        'admin', 'Issue a refund'],
        ]
      ),

      divider(),
      h2('Reviews  —  /api/reviews'),
      table(
        ['Method', 'Endpoint', 'Auth Required', 'Description'],
        [
          ['POST',   '/api/reviews',   'tourist', 'Submit review (completed bookings only)'],
          ['DELETE', '/api/reviews/:id','Yes',    'Delete own review (admin can delete any)'],
        ]
      ),

      divider(),
      h2('Users  —  /api/users'),
      table(
        ['Method', 'Endpoint', 'Auth Required', 'Description'],
        [
          ['GET',   '/api/users/profile',         'Yes',   'Get own profile'],
          ['PUT',   '/api/users/profile',         'Yes',   'Update profile'],
          ['PUT',   '/api/users/fcm-token',       'Yes',   'Register Firebase FCM push token'],
          ['PUT',   '/api/users/change-password', 'Yes',   'Change password'],
          ['POST',  '/api/users/avatar',          'Yes',   'Upload avatar image'],
          ['GET',   '/api/users/admin/users',     'admin', 'List all users'],
          ['PATCH', '/api/users/admin/users/:id', 'admin', 'Update user role or status'],
          ['GET',   '/api/users/admin/stats',     'admin', 'Dashboard statistics'],
        ]
      ),

      divider(),
      h2('Companies  —  /api/companies'),
      table(
        ['Method', 'Endpoint', 'Auth Required', 'Description'],
        [
          ['GET',   '/api/companies',     'No',     'List all companies'],
          ['GET',   '/api/companies/:id', 'No',     'Company detail + tours'],
          ['POST',  '/api/companies',     'company','Create company profile'],
          ['PUT',   '/api/companies/:id', 'company','Update company profile'],
        ]
      ),

      divider(),
      h2('Chat (GuideonBot)  —  /api/chat'),
      table(
        ['Method', 'Endpoint', 'Auth Required', 'Description'],
        [
          ['POST', '/api/chat', 'No', 'Send message to GuideonBot AI (GPT-4o-mini) — 20 req/hr per IP'],
        ]
      ),
      p('Request body: { "messages": [{ "role": "user", "content": "..." }] }'),

      // ── 5. SEED CREDENTIALS ───────────────────────────────────────────────
      pageBreak(),
      h1('5. Seed / Test Credentials'),
      p('Use these accounts for testing (seeded via database/seed.sql):'),
      table(
        ['Role', 'Email', 'Password'],
        [
          ['admin',   'admin@guideon.com',        'Password123!'],
          ['company', 'company@muscatadventures.com',  'Password123!'],
          ['guide',   'guide@guideon.com',         'Password123!'],
          ['tourist', 'tourist@example.com',            'Password123!'],
        ]
      ),

      divider(),
      h2('Authentication Header'),
      code('Authorization: Bearer <accessToken>'),
      p('Access tokens expire in 7 days. Use POST /api/auth/refresh with refreshToken to get new tokens.'),

      // ── 6. PAYMENT FLOW ───────────────────────────────────────────────────
      pageBreak(),
      h1('6. Payment Flow (Stripe)'),
      h2('How It Works'),
      bullet('1. Tourist creates a booking → receives booking_id'),
      bullet('2. Frontend calls POST /api/payments/create-intent with booking_id → receives clientSecret'),
      bullet('3. Frontend uses Stripe.js with clientSecret to complete payment'),
      bullet('4. Stripe sends webhook to POST /api/payments/webhook'),
      bullet('5. Webhook updates booking: status = confirmed, payment_status = paid'),
      bullet('6. Confirmation email sent via Resend + push notification via Firebase'),

      divider(),
      h2('Stripe Webhook (local testing)'),
      code('stripe listen --forward-to localhost:3000/api/payments/webhook'),
      p('Copy the webhook signing secret → update STRIPE_WEBHOOK_SECRET in .env'),

      // ── 7. EMAIL NOTIFICATIONS ────────────────────────────────────────────
      pageBreak(),
      h1('7. Email Notifications (Resend)'),
      table(
        ['Event', 'Trigger', 'Template'],
        [
          ['Booking Confirmed',  'Stripe payment_intent.succeeded webhook', 'Green badge, full booking details, CTA button'],
          ['Booking Cancelled',  'User cancel or refund issued',             'Red badge, refund notice, Browse Tours button'],
        ]
      ),
      divider(),
      h2('Resend Account'),
      kv('API Key',   're_43dnbDNB_C59XJtiSgQcWMvzxQFoac1qi'),
      kv('From',      'GUIDEON <onboarding@resend.dev>  (test mode)'),
      kv('Dashboard', 'https://resend.com/emails'),
      p('To send to any address (not just your own): verify domain guideon.com in Resend dashboard.'),
      h3('DKIM DNS Record to add in NameBright:'),
      table(
        ['Type', 'Name', 'Value'],
        [
          ['TXT', 'resend._domainkey', 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDDBNxSeC++LwoDeMy1MK+MeL4CltZ36GAsaUpcgu4CF/vxeNS5K+x+gn4MBYTGfMceHcdZWxFhEAKw/l2M2LltieWLkEf8YxBeIyeeOsKHceYJjX7qmsD8CmL3UnA36pSxoj9IsYlZjzzwclEHDxM/O0ak/fyXqjobUw2Kx1GCpwIDAQAB'],
        ]
      ),

      // ── 8. PUSH NOTIFICATIONS ─────────────────────────────────────────────
      pageBreak(),
      h1('8. Firebase Push Notifications (FCM)'),
      table(
        ['Notification', 'Trigger'],
        [
          ['Booking Confirmed 🎉',  'Stripe payment succeeded'],
          ['Booking Cancelled',     'User cancels or refund issued'],
          ['Payment Failed',        'Stripe payment_intent.payment_failed'],
        ]
      ),
      divider(),
      h2('Setup Steps'),
      bullet('1. Create project at firebase.google.com'),
      bullet('2. Project Settings → Service Accounts → Generate new private key (JSON file)'),
      bullet('3. Copy projectId, clientEmail, privateKey into .env'),
      bullet('4. Add google-services.json to Flutter app (android/app/)'),

      // ── 9. DEPLOYMENT ─────────────────────────────────────────────────────
      pageBreak(),
      h1('9. Deployment Guide (Railway)'),

      h2('Step 1 — Push to GitHub'),
      code('git remote add origin https://github.com/YOUR_USERNAME/GUIDEON.git'),
      code('git branch -M main'),
      code('git push -u origin main'),

      divider(),
      h2('Step 2 — Railway Setup'),
      bullet('1. Go to railway.app → Sign in with GitHub'),
      bullet('2. New Project → Deploy from GitHub repo → Select GUIDEON'),
      bullet('3. New → Database → PostgreSQL'),
      bullet('4. Link DATABASE_URL to the Node service'),

      divider(),
      h2('Step 3 — Railway Environment Variables'),
      table(
        ['Variable', 'Value'],
        [
          ['NODE_ENV',              'production'],
          ['DATABASE_URL',          '(auto-link from Railway PostgreSQL)'],
          ['JWT_SECRET',            '(strong random string)'],
          ['JWT_EXPIRES_IN',        '7d'],
          ['JWT_REFRESH_SECRET',    '(strong random string)'],
          ['JWT_REFRESH_EXPIRES_IN','30d'],
          ['STRIPE_SECRET_KEY',     'sk_test_...'],
          ['STRIPE_WEBHOOK_SECRET', 'whsec_...'],
          ['RESEND_API_KEY',        're_43dnbDNB_C59XJtiSgQcWMvzxQFoac1qi'],
          ['EMAIL_FROM',            'GUIDEON <onboarding@resend.dev>'],
          ['OPENAI_API_KEY',        'sk-proj-...'],
          ['APP_URL',               'https://api.guideon.com'],
          ['CLIENT_URL',            '*'],
        ]
      ),

      divider(),
      h2('Step 4 — Run DB Migration on Railway'),
      code('npm run migrate'),
      p('Run this in Railway Shell after first deploy to create all tables and triggers.'),

      divider(),
      h2('Step 5 — Connect Domain'),
      table(
        ['Type', 'Name', 'Value'],
        [
          ['CNAME', 'api', '(your-service).up.railway.app'],
        ]
      ),
      p('Add this DNS record in NameBright → DNS Records for guideon.com'),
      p('Final API URL: https://api.guideon.com'),

      // ── 10. POSTMAN ───────────────────────────────────────────────────────
      pageBreak(),
      h1('10. Postman Collection'),
      p('File: GUIDEON.postman_collection.json (in project root)'),
      p('Import into Postman → all 37 endpoints pre-configured with auto-token saving.'),
      divider(),
      h2('Collection Variables'),
      table(
        ['Variable', 'Default', 'Description'],
        [
          ['base_url',        'http://localhost:3000', 'API base URL'],
          ['access_token',    '(auto-filled)',          'JWT access token (auto-saved on login)'],
          ['refresh_token',   '(auto-filled)',          'JWT refresh token (auto-saved on login)'],
          ['tour_id',         '',                       'Set after creating a tour'],
          ['booking_id',      '(auto-filled)',          'Auto-saved after creating a booking'],
          ['company_id',      '',                       'Set after creating a company'],
          ['review_id',       '',                       'Set after creating a review'],
        ]
      ),

      // ── 11. DATABASE ──────────────────────────────────────────────────────
      pageBreak(),
      h1('11. Database Schema'),
      h2('Tables'),
      table(
        ['Table', 'Description', 'Key Columns'],
        [
          ['users',             'All user accounts',           'id (UUID), name, email, role, fcm_token, refresh_token'],
          ['companies',         'Tour operator profiles',      'id, user_id, company_name, verified'],
          ['tours',             'Tour listings',               'id, company_id, title, price, category, difficulty, avg_rating'],
          ['tour_images',       'Tour photos',                 'id, tour_id, image_url, is_primary'],
          ['tour_availability', 'Available dates per tour',   'id, tour_id, date, available_spots, total_spots'],
          ['bookings',          'Customer bookings',           'id, tour_id, user_id, status, payment_status, stripe_payment_intent_id'],
          ['reviews',           'Customer reviews',            'id, tour_id, user_id, booking_id, rating, comment'],
        ]
      ),
      divider(),
      h2('Booking Status Values'),
      table(
        ['Field', 'Possible Values'],
        [
          ['status',         'pending | confirmed | cancelled | completed'],
          ['payment_status', 'unpaid | paid | refunded'],
        ]
      ),
      divider(),
      h2('Auto Triggers'),
      bullet('trg_*_updated_at — auto-updates updated_at on every row change'),
      bullet('trg_reviews_rating — auto-recalculates avg_rating and total_reviews on tours when reviews change'),

      // ── 12. FLUTTER APP ───────────────────────────────────────────────────
      pageBreak(),
      h1('12. Flutter Mobile App'),
      kv('Location', 'C:\\Users\\hh952\\OneDrive\\Desktop\\oman\\oman_explorer_app'),
      kv('API Base URL (emulator)', 'http://10.0.2.2:3000/api'),
      divider(),
      h2('Dependencies'),
      table(
        ['Package', 'Version', 'Purpose'],
        [
          ['http',                    '^1.2.0',   'HTTP API calls'],
          ['shared_preferences',      '^2.2.2',   'Store JWT tokens locally'],
          ['provider',                '^6.1.1',   'State management'],
          ['cached_network_image',    '^3.3.1',   'Tour image caching'],
          ['intl',                    '^0.19.0',  'Date formatting'],
          ['flutter_rating_bar',      '^4.0.1',   'Star rating widget'],
          ['firebase_core',           '^3.6.0',   'Firebase initialization'],
          ['firebase_messaging',      '^15.1.3',  'Push notifications'],
          ['flutter_local_notifications','^17.2.2','Show notifications in foreground'],
        ]
      ),
      divider(),
      h2('Run the App'),
      code('cd C:\\Users\\hh952\\OneDrive\\Desktop\\oman\\oman_explorer_app'),
      code('flutter pub get'),
      code('flutter run'),

      // ── END ───────────────────────────────────────────────────────────────
      pageBreak(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 800 },
        children: [new TextRun({ text: '— End of Documentation —', size: 24, color: '999999' })],
      }),
    ],
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  const outPath = path.join(__dirname, '../GUIDEON_Documentation.docx');
  fs.writeFileSync(outPath, buffer);
  console.log(`✅ Document saved: ${outPath}`);
});
