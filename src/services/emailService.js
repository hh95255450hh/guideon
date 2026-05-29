const { Resend } = require('resend');

let _resend = null;
function getResend() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes('REPLACE')) {
      return null;
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM      = process.env.EMAIL_FROM      || 'Guideon <noreply@guideon.om>';
const REPLY_TO  = process.env.EMAIL_REPLY_TO  || 'info@guideon.om';
const APP_URL   = process.env.APP_URL         || 'https://www.guideon.om';
const PUBLIC_URL= process.env.PUBLIC_URL      || 'https://www.guideon.om';
const LOGO_URL  = process.env.EMAIL_LOGO_URL  || `${PUBLIC_URL}/logo.png`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL   || 'admin@guideon.om';

// ── Layout ────────────────────────────────────────────────────────────────────
function layout(body, preheader = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#f0f4f3;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#1a1a1a;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f0f4f3;opacity:0;">${preheader}</div>` : ''}
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:#f0f4f3;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation"
           style="background:#fff;border-radius:14px;overflow:hidden;
                  box-shadow:0 4px 16px rgba(0,0,0,0.09);max-width:600px;width:100%;">

      <!-- Header with real logo -->
      <tr>
        <td style="background:linear-gradient(135deg,#0f1c3e 0%,#1a2c5b 50%,#0f7b6c 100%);padding:32px 40px;text-align:center;">
          <img src="${LOGO_URL}" alt="Guideon" width="180" height="auto" style="display:inline-block;max-width:180px;height:auto;margin-bottom:6px;border:0;outline:none;text-decoration:none;">
          <div style="color:rgba(255,255,255,0.85);font-size:11px;letter-spacing:2px;margin-top:8px;font-weight:600;">
            DISCOVER OMAN WITH A LOCAL GUIDE
          </div>
        </td>
      </tr>

      <!-- Body -->
      <tr><td style="padding:36px 40px 28px;">${body}</td></tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8faf9;border-top:1px solid #e8efed;padding:24px 40px;text-align:center;">
          <p style="margin:0 0 8px;font-size:13px;color:#666;line-height:1.7;font-weight:600;">
            Guideon &mdash; Find Your Certified Local Guide in Oman
          </p>
          <p style="margin:0 0 10px;font-size:12px;color:#888;line-height:1.7;">
            <a href="${APP_URL}" style="color:#0f7b6c;text-decoration:none;font-weight:600;">www.guideon.om</a>
            &nbsp;&middot;&nbsp;
            <a href="mailto:info@guideon.om" style="color:#0f7b6c;text-decoration:none;">info@guideon.om</a>
            &nbsp;&middot;&nbsp;
            <a href="tel:+96895255450" style="color:#0f7b6c;text-decoration:none;">+968 9525 5450</a>
          </p>
          <p style="margin:0;font-size:11px;color:#aaa;">
            Muscat, Sultanate of Oman &nbsp;&middot;&nbsp; &copy; ${new Date().getFullYear()} Guideon. All rights reserved.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function row(label, value) {
  return `<tr>
    <td style="padding:10px 16px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0;width:140px;">${label}</td>
    <td style="padding:10px 16px;font-size:13px;color:#1a1a1a;font-weight:600;border-bottom:1px solid #f0f0f0;">${value}</td>
  </tr>`;
}

function btn(text, url, color = '#0f7b6c') {
  return `<div style="text-align:center;margin:28px 0 8px;">
    <a href="${url}" style="background:${color};color:#fff;text-decoration:none;
       padding:14px 36px;border-radius:8px;font-size:14px;font-weight:700;display:inline-block;">
      ${text}
    </a>
  </div>`;
}

function badge(text, color, bg) {
  return `<div style="background:${bg};border:1px solid ${color};border-radius:8px;
             padding:12px 20px;margin-bottom:24px;display:inline-block;">
    <span style="color:${color};font-weight:700;font-size:14px;">${text}</span>
  </div>`;
}

function table(...rows) {
  return `<table width="100%" cellpadding="0" cellspacing="0"
    style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:24px;">
    ${rows.join('')}
  </table>`;
}

// Bilingual body: Arabic block on top (RTL), divider, English block below (LTR).
// `ar` and `en` are HTML strings for each language's content.
function bilingual(ar, en) {
  return `
    <div dir="rtl" lang="ar" style="text-align:right;">${ar}</div>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:14px 0;">
      <tr>
        <td style="border-top:1px solid #e8efed;height:1px;font-size:0;line-height:0;">&nbsp;</td>
        <td style="width:60px;text-align:center;color:#aaa;font-size:10px;letter-spacing:2px;padding:0 8px;">ENGLISH</td>
        <td style="border-top:1px solid #e8efed;height:1px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>
    </table>
    <div dir="ltr" lang="en">${en}</div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
//  TOURIST EMAILS
// ══════════════════════════════════════════════════════════════════════════════

function touristWelcome({ name }) {
  return layout(bilingual(
    `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">مرحباً بك في Guideon! 🌿</h1>
     <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.85;">
       أهلاً <strong>${name}</strong>، حسابك جاهز الآن. اكتشف عُمان مع مرشد محلي معتمد —
       من رمال الوهيبة إلى مضايق مسندم.
     </p>
     ${btn('ابحث عن مرشد', `${APP_URL}/search.html`)}
     <p style="margin:16px 0 0;font-size:13px;color:#888;text-align:center;line-height:1.6;">
       تحتاج مساعدة؟ فقط رُدّ على هذه الرسالة — نحن هنا من أجلك.
     </p>`,
    `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">Welcome to Guideon! 🌿</h1>
     <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.7;">
       Hi <strong>${name}</strong>, your account is ready. Explore Oman with a certified local guide —
       from the deserts of Wahiba Sands to the fjords of Musandam.
     </p>
     ${btn('Find a Guide', `${APP_URL}/search.html`)}
     <p style="margin:16px 0 0;font-size:13px;color:#888;text-align:center;line-height:1.6;">
       Need help? Just reply to this email — we're here for you.
     </p>`
  ));
}

function touristBookingPending({ name, guideName, destination, tourDate, duration, totalAmount, bookingId }) {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">Booking Request Sent ⏳</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      Hi <strong>${name}</strong>, your request has been sent to <strong>${guideName}</strong>.
      You'll receive a confirmation once the guide accepts.
    </p>
    ${badge('⏳ PENDING CONFIRMATION', '#b37400', '#fffbea')}
    ${table(
      row('Guide',       guideName),
      row('Destination', destination),
      row('Date',        new Date(tourDate).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })),
      row('Duration',    duration === 'half' ? 'Half Day' : 'Full Day'),
      row('Total',       `${parseFloat(totalAmount).toFixed(2)} OMR`),
      row('Booking ID',  `<span style="font-family:monospace;font-size:12px;">${bookingId}</span>`),
    )}
    ${btn('View My Bookings', `${APP_URL}/tourist-dashboard.html`)}
  `);
}

function touristBookingConfirmed({ name, guideName, destination, tourDate, totalAmount, bookingId }) {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">Booking Confirmed! 🎉</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      Great news, <strong>${name}</strong>! <strong>${guideName}</strong> has confirmed your tour.
      Get ready for an unforgettable Omani experience.
    </p>
    ${badge('✓ CONFIRMED', '#0f7b6c', '#e8f5f2')}
    ${table(
      row('Guide',       guideName),
      row('Destination', destination),
      row('Date',        new Date(tourDate).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })),
      row('Total',       `${parseFloat(totalAmount).toFixed(2)} OMR`),
      row('Booking ID',  `<span style="font-family:monospace;font-size:12px;">${bookingId}</span>`),
    )}
    ${btn('View My Bookings', `${APP_URL}/tourist-dashboard.html`)}
  `);
}

function touristBookingCancelled({ name, guideName, destination, bookingId }) {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">Booking Cancelled</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      Hi <strong>${name}</strong>, your booking with <strong>${guideName}</strong> has been cancelled.
    </p>
    ${badge('✕ CANCELLED', '#cc0000', '#fff3f3')}
    ${table(
      row('Guide',       guideName),
      row('Destination', destination),
      row('Booking ID',  `<span style="font-family:monospace;font-size:12px;">${bookingId}</span>`),
    )}
    <div style="background:#fffbea;border:1px solid #ffe58a;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#7a6300;line-height:1.6;">
        💳 If you paid for this booking, a full refund will be processed within <strong>5–10 business days</strong>.
      </p>
    </div>
    ${btn('Find Another Guide', `${APP_URL}/search.html`)}
  `);
}

function touristTripStarted({ name, guideName, guidePhone, destination, bookingId }) {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">Your Trip Has Started! 🚀</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      Hi <strong>${name}</strong>, your tour with <strong>${guideName}</strong> in <strong>${destination}</strong>
      has officially started. Enjoy every moment of your Omani adventure!
    </p>
    ${badge('🟢 TRIP IN PROGRESS', '#0f7b6c', '#e8f5f2')}
    ${table(
      row('Guide',       guideName),
      row('Destination', destination),
      row('Guide phone', guidePhone || 'See your booking details'),
      row('Booking ID',  `<span style="font-family:monospace;font-size:12px;">${bookingId}</span>`),
    )}
    <div style="background:#e8f5f2;border:1px solid #b2d8ce;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#0f5c50;line-height:1.6;">
        💡 <strong>Tip:</strong> Take lots of photos! You'll be able to share them with your review when the trip ends.
      </p>
    </div>
    ${btn('Open My Bookings', `${APP_URL}/tourist-dashboard.html`)}
  `);
}

function touristReviewReminder({ name, guideName, destination, bookingId }) {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">How was your tour? ⭐</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      Hi <strong>${name}</strong>, we hope you had an amazing experience with <strong>${guideName}</strong>
      in <strong>${destination}</strong>! Your review helps other travellers choose the right guide.
    </p>
    ${btn('Leave a Review', `${APP_URL}/tourist-dashboard.html`)}
    <p style="margin:16px 0 0;font-size:12px;color:#aaa;text-align:center;">Booking ID: ${bookingId}</p>
  `);
}

// ══════════════════════════════════════════════════════════════════════════════
//  GUIDE EMAILS
// ══════════════════════════════════════════════════════════════════════════════

function guideWelcome({ name }) {
  return layout(bilingual(
    `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">مرحباً بك في Guideon! 🌿</h1>
     <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.85;">
       أهلاً <strong>${name}</strong>، تم إنشاء حساب المرشد الخاص بك. سيقوم فريقنا بمراجعة
       وتوثيق ترخيصك قريباً. ستصلك رسالة بريد فور الموافقة.
     </p>
     <div style="background:#e8f5f2;border:1px solid #b2d8ce;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
       <p style="margin:0;font-size:13px;color:#0f5c50;line-height:1.7;text-align:right;">
         📋 <strong>الخطوات التالية:</strong> أكمل ملفك، أضف مواعيد توفّرك، وانتظر التوثيق.
         بمجرد التوثيق، سيتمكن السياح من إيجادك وحجزك.
       </p>
     </div>
     ${btn('أكمل ملفي', `${APP_URL}/guide-dashboard.html`)}`,
    `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">Welcome to Guideon! 🌿</h1>
     <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.7;">
       Hi <strong>${name}</strong>, your guide account has been created. Our team will review
       and verify your licence shortly. You'll receive an email once approved.
     </p>
     <div style="background:#e8f5f2;border:1px solid #b2d8ce;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
       <p style="margin:0;font-size:13px;color:#0f5c50;line-height:1.6;">
         📋 <strong>Next steps:</strong> Complete your profile, add your availability, and wait for verification.
         Once verified, tourists can find and book you.
       </p>
     </div>
     ${btn('Complete My Profile', `${APP_URL}/guide-dashboard.html`)}`
  ));
}

function guideNewBooking({ name, touristName, destination, tourDate, duration, participants, totalAmount, bookingId }) {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">New Booking Request! 📩</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      Hi <strong>${name}</strong>, you have a new booking request from <strong>${touristName}</strong>.
      Please confirm or decline within 24 hours.
    </p>
    ${badge('⏳ ACTION REQUIRED', '#b37400', '#fffbea')}
    ${table(
      row('Tourist',     touristName),
      row('Destination', destination),
      row('Date',        new Date(tourDate).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })),
      row('Duration',    duration === 'half' ? 'Half Day' : 'Full Day'),
      row('Participants', participants),
      row('Your Earning', `${parseFloat(totalAmount).toFixed(2)} OMR`),
      row('Booking ID',  `<span style="font-family:monospace;font-size:12px;">${bookingId}</span>`),
    )}
    ${btn('Confirm or Decline', `${APP_URL}/guide-dashboard.html`)}
  `);
}

function guideBookingConfirmed({ name, touristName, destination, tourDate, totalAmount, bookingId }) {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">Booking Confirmed ✓</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      Hi <strong>${name}</strong>, you've confirmed the booking with <strong>${touristName}</strong>.
      Their date is now blocked from your availability.
    </p>
    ${table(
      row('Tourist',     touristName),
      row('Destination', destination),
      row('Date',        new Date(tourDate).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })),
      row('Earning',     `${parseFloat(totalAmount).toFixed(2)} OMR`),
      row('Booking ID',  `<span style="font-family:monospace;font-size:12px;">${bookingId}</span>`),
    )}
    ${btn('View My Bookings', `${APP_URL}/guide-dashboard.html`)}
  `);
}

function guideBookingCancelled({ name, touristName, destination, tourDate, bookingId }) {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">Booking Cancelled</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      Hi <strong>${name}</strong>, the booking with <strong>${touristName}</strong> has been cancelled.
      The date has been restored to your availability.
    </p>
    ${badge('✕ CANCELLED', '#cc0000', '#fff3f3')}
    ${table(
      row('Tourist',     touristName),
      row('Destination', destination),
      row('Date',        new Date(tourDate).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })),
      row('Booking ID',  `<span style="font-family:monospace;font-size:12px;">${bookingId}</span>`),
    )}
    ${btn('View My Dashboard', `${APP_URL}/guide-dashboard.html`)}
  `);
}

function guideVerified({ name }) {
  return layout(bilingual(
    `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">تم توثيق حسابك! 🎉</h1>
     <p style="margin:0 0 18px;font-size:15px;color:#555;line-height:1.85;">
       مبروك <strong>${name}</strong>! تم توثيق حساب المرشد الخاص بك من قِبل فريق Guideon.
       أصبحت الآن ظاهراً للسياح ويمكنك البدء في استقبال الحجوزات.
     </p>
     <div style="text-align:right;margin-bottom:18px;">${badge('✓ مرشد موثّق', '#0f7b6c', '#e8f5f2')}</div>
     <div style="background:#e8f5f2;border:1px solid #b2d8ce;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
       <p style="margin:0;font-size:13px;color:#0f5c50;line-height:1.7;text-align:right;">
         🗓️ <strong>أضف مواعيد توفّرك</strong> حتى يتمكن السياح من حجز رحلاتك.
       </p>
     </div>
     ${btn('حدّد مواعيدي', `${APP_URL}/guide-dashboard.html`)}`,
    `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">You're Verified! 🎉</h1>
     <p style="margin:0 0 18px;font-size:15px;color:#555;line-height:1.7;">
       Congratulations <strong>${name}</strong>! Your guide account has been verified by the Guideon team.
       You are now visible to tourists and can start receiving bookings.
     </p>
     ${badge('✓ VERIFIED GUIDE', '#0f7b6c', '#e8f5f2')}
     <div style="background:#e8f5f2;border:1px solid #b2d8ce;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
       <p style="margin:0;font-size:13px;color:#0f5c50;line-height:1.6;">
         🗓️ <strong>Add your availability</strong> so tourists can book your tours.
       </p>
     </div>
     ${btn('Set My Availability', `${APP_URL}/guide-dashboard.html`)}`
  ));
}

function guideNewReview({ name, touristName, rating, comment, destination }) {
  const stars = '⭐'.repeat(Math.min(Math.max(rating, 1), 5));
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">New Review Received! ${stars}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      Hi <strong>${name}</strong>, <strong>${touristName}</strong> left you a review for your tour in <strong>${destination}</strong>.
    </p>
    <div style="background:#f9fafb;border-left:4px solid #0f7b6c;border-radius:0 8px 8px 0;
                padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:22px;margin-bottom:8px;">${stars}</div>
      <p style="margin:0;font-size:14px;color:#333;line-height:1.7;font-style:italic;">
        "${comment || 'No comment provided.'}"
      </p>
      <p style="margin:12px 0 0;font-size:12px;color:#888;">— ${touristName}</p>
    </div>
    ${btn('View My Profile', `${APP_URL}/guide-dashboard.html`)}
  `);
}

// ══════════════════════════════════════════════════════════════════════════════
//  COMPANY EMAILS
// ══════════════════════════════════════════════════════════════════════════════

function companyVerified({ name, companyName }) {
  return layout(bilingual(
    `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">تمت الموافقة على شركتك! 🎉</h1>
     <p style="margin:0 0 18px;font-size:15px;color:#555;line-height:1.85;">
       مبروك <strong>${name}</strong>! تمت مراجعة <strong>${companyName}</strong> والموافقة عليها من فريق Guideon.
       شركتك الآن منشورة وظاهرة للسياح الذين يتصفحون المنصة.
     </p>
     <div style="text-align:right;margin-bottom:18px;">${badge('✓ موافَق عليها ومنشورة', '#0f7b6c', '#e8f5f2')}</div>
     <div style="background:#e8f5f2;border:1px solid #b2d8ce;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
       <p style="margin:0;font-size:13px;color:#0f5c50;line-height:1.7;text-align:right;">
         📦 <strong>الخطوة التالية:</strong> أضف باقات رحلاتك وخدماتك من لوحة التحكم ليكتشفها السياح.
       </p>
     </div>
     ${btn('اذهب للوحة الشركة', `${APP_URL}/company-dashboard.html`)}`,
    `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">Your Company is Approved! 🎉</h1>
     <p style="margin:0 0 18px;font-size:15px;color:#555;line-height:1.7;">
       Congratulations <strong>${name}</strong>! <strong>${companyName}</strong> has been reviewed and approved by the Guideon team.
       Your company is now live and visible to tourists browsing the platform.
     </p>
     ${badge('✓ APPROVED & LISTED', '#0f7b6c', '#e8f5f2')}
     <div style="background:#e8f5f2;border:1px solid #b2d8ce;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
       <p style="margin:0;font-size:13px;color:#0f5c50;line-height:1.6;">
         📦 <strong>Next step:</strong> Add your tour packages and services from your dashboard so tourists can discover your offerings.
       </p>
     </div>
     ${btn('Go to Company Dashboard', `${APP_URL}/company-dashboard.html`)}`
  ));
}

function companyWelcome({ name, companyName }) {
  return layout(bilingual(
    `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">مرحباً بك في Guideon! 🏢</h1>
     <p style="margin:0 0 18px;font-size:15px;color:#555;line-height:1.85;">
       أهلاً <strong>${name}</strong>، تم إنشاء حساب شركة <strong>${companyName}</strong>.
       سيراجع فريقنا ملفك قبل نشره للسياح.
     </p>
     <div style="background:#e8f0ff;border:1px solid #b0c4f5;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
       <p style="margin:0;font-size:13px;color:#1a3a7a;line-height:1.7;text-align:right;">
         📋 <strong>الخطوات التالية:</strong> أكمل ملف شركتك، أضف باقات الرحلات والخدمات.
         بعد المراجعة، سيتمكن السياح من اكتشاف شركتك والتواصل معها.
       </p>
     </div>
     ${btn('اذهب للوحة الشركة', `${APP_URL}/company-dashboard.html`)}`,
    `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">Welcome to Guideon! 🏢</h1>
     <p style="margin:0 0 18px;font-size:15px;color:#555;line-height:1.7;">
       Hi <strong>${name}</strong>, your company account for <strong>${companyName}</strong> has been created.
       Our team will review your profile before it goes live to tourists.
     </p>
     <div style="background:#e8f0ff;border:1px solid #b0c4f5;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
       <p style="margin:0;font-size:13px;color:#1a3a7a;line-height:1.6;">
         📋 <strong>Next steps:</strong> Complete your company profile, add your tour packages and services.
         Once reviewed, tourists can discover and contact your company.
       </p>
     </div>
     ${btn('Go to Company Dashboard', `${APP_URL}/company-dashboard.html`)}`
  ));
}

// ══════════════════════════════════════════════════════════════════════════════
//  AUTH EMAILS (verification & password reset)
// ══════════════════════════════════════════════════════════════════════════════

function emailVerification({ name, token }) {
  const link = `${APP_URL}/api/auth/verify-email/${token}`;
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">Confirm Your Email ✉️</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      Hi <strong>${name}</strong>, welcome to Guideon! Please confirm your email address to activate your account.
    </p>
    ${btn('Verify Email', link)}
    <p style="margin:16px 0 0;font-size:12px;color:#888;text-align:center;line-height:1.6;">
      Or copy this link into your browser:<br>
      <span style="font-family:monospace;font-size:11px;color:#0f7b6c;word-break:break-all;">${link}</span>
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#aaa;text-align:center;">
      This link expires in 24 hours. If you didn't sign up for Guideon, ignore this email.
    </p>
  `);
}

function passwordReset({ name, token }) {
  const link = `${APP_URL}/reset-password.html?token=${token}`;
  return layout(bilingual(
    `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">إعادة تعيين كلمة المرور 🔐</h1>
     <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.85;">
       مرحباً <strong>${name}</strong>، استلمنا طلباً لإعادة تعيين كلمة المرور. اضغط الزر أدناه لاختيار كلمة مرور جديدة.
     </p>
     ${btn('إعادة تعيين كلمة المرور', link, '#cc0000')}
     <div style="background:#fffbea;border:1px solid #ffe58a;border-radius:8px;padding:16px 20px;margin-top:20px;">
       <p style="margin:0;font-size:13px;color:#7a6300;line-height:1.7;text-align:right;">
         ⏰ ينتهي هذا الرابط خلال <strong>ساعة واحدة</strong>. إذا لم تطلب ذلك، تجاهل هذه الرسالة — لن تتغير كلمة مرورك.
       </p>
     </div>`,
    `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">Reset Your Password 🔐</h1>
     <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.7;">
       Hi <strong>${name}</strong>, we received a request to reset your password. Click the button below to choose a new password.
     </p>
     ${btn('Reset Password', link, '#cc0000')}
     <p style="margin:16px 0 0;font-size:12px;color:#888;text-align:center;line-height:1.6;">
       Or copy this link into your browser:<br>
       <span style="font-family:monospace;font-size:11px;color:#0f7b6c;word-break:break-all;">${link}</span>
     </p>
     <div style="background:#fffbea;border:1px solid #ffe58a;border-radius:8px;padding:16px 20px;margin-top:20px;">
       <p style="margin:0;font-size:13px;color:#7a6300;line-height:1.6;">
         ⏰ This link expires in <strong>1 hour</strong>. If you didn't request this, ignore this email — your password won't change.
       </p>
     </div>`
  ));
}

// ══════════════════════════════════════════════════════════════════════════════
//  ADMIN EMAILS
// ══════════════════════════════════════════════════════════════════════════════

function adminNewGuide({ guideName, guideEmail, licenceNumber, isMinistryLicensed, destinations, languages }) {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">New Guide Registration 📋</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      A new guide has registered and is pending verification.
    </p>
    ${table(
      row('Name',         guideName),
      row('Email',        guideEmail),
      row('MOT Status',   isMinistryLicensed ? '🏛️ Ministry Licensed' : '⚠️ Pending Licence'),
      row('Licence',      licenceNumber || 'Not provided'),
      row('Destinations', (destinations || []).join(', ') || 'Not specified'),
      row('Languages',    (languages    || []).join(', ') || 'Not specified'),
    )}
    ${btn('Verify in Admin Panel', `${APP_URL}/admin.html`, '#1a1a2e')}
  `);
}

function adminNewCompany({ companyName, email, companyRegNo }) {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">New Company Registration 🏢</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      A new tourism company has registered and is pending review.
    </p>
    ${table(
      row('Company',  companyName),
      row('Email',    email),
      row('Reg. No.', companyRegNo || 'Not provided'),
    )}
    ${btn('Review in Admin Panel', `${APP_URL}/admin.html`, '#1a1a2e')}
  `);
}

// ══════════════════════════════════════════════════════════════════════════════
//  SEND HELPER
// ══════════════════════════════════════════════════════════════════════════════
//
// Strips HTML tags to produce a plain-text alternative. Email clients that don't
// render HTML use this; spam filters also rank multipart messages higher.
function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

async function send(to, subject, html) {
  const resend = getResend();
  if (!resend) {
    console.log(`[Email] Skipped (no API key): ${subject} → ${to}`);
    return;
  }
  try {
    // Anti-spam: keep subject clean. Most major filters penalise messages
    // whose subject is mostly emoji or punctuation.
    const cleanSubject = String(subject || 'Message from Guideon').trim().slice(0, 180);

    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: cleanSubject,
      html,
      text: htmlToText(html),
      reply_to: REPLY_TO,
      headers: {
        'List-Unsubscribe': `<mailto:unsubscribe@www.guideon.om?subject=Unsubscribe>, <${APP_URL}/api/newsletter/unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Entity-Ref-ID': `guideon-${Date.now()}`,
        'X-Mailer': 'Guideon Platform',
      },
    });
    if (error) console.error(`[Email] Failed: ${cleanSubject} → ${to}:`, error.message);
    else console.log(`[Email] Sent: ${cleanSubject} → ${to}`);
  } catch (err) {
    console.error(`[Email] Error: ${subject} → ${to}:`, err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════════════════════════════════════════
module.exports = {
  // Low-level — for ad-hoc emails (Q&A, newsletter welcome, etc.)
  send: (to, subject, html) => send(to, subject, html),

  // Tourist
  sendTouristWelcome: (data) =>
    send(data.email, 'Welcome to Guideon', touristWelcome(data)),

  sendTouristBookingPending: (data) =>
    send(data.email, `Booking request sent — ${data.destination}`, touristBookingPending(data)),

  sendTouristBookingConfirmed: (data) =>
    send(data.email, `Your booking is confirmed — ${data.destination}`, touristBookingConfirmed(data)),

  sendTouristBookingCancelled: (data) =>
    send(data.email, `Booking cancelled — ${data.destination}`, touristBookingCancelled(data)),

  sendTouristTripStarted: (data) =>
    send(data.email, `Your tour with ${data.guideName} has started`, touristTripStarted(data)),

  sendTouristReviewReminder: (data) =>
    send(data.email, `How was your tour with ${data.guideName}?`, touristReviewReminder(data)),

  // Guide
  sendGuideWelcome: (data) =>
    send(data.email, 'Welcome to Guideon — Account created', guideWelcome(data)),

  sendGuideNewBooking: (data) =>
    send(data.email, `New booking request — ${data.destination}`, guideNewBooking(data)),

  sendGuideBookingConfirmed: (data) =>
    send(data.email, `Booking confirmed — ${data.destination}`, guideBookingConfirmed(data)),

  sendGuideBookingCancelled: (data) =>
    send(data.email, `Booking cancelled — ${data.destination}`, guideBookingCancelled(data)),

  sendGuideVerified: (data) =>
    send(data.email, 'Your Guideon account is verified', guideVerified(data)),

  sendGuideNewReview: (data) =>
    send(data.email, `New review from ${data.touristName}`, guideNewReview(data)),

  // Company
  sendCompanyWelcome: (data) =>
    send(data.email, 'Welcome to Guideon — Company account created', companyWelcome(data)),

  sendCompanyVerified: (data) =>
    send(data.email, `${data.companyName} is now live on Guideon`, companyVerified(data)),

  // Auth
  sendEmailVerification: (data) =>
    send(data.email, 'Please confirm your email address', emailVerification(data)),

  sendPasswordReset: (data) =>
    send(data.email, 'Reset your Guideon password', passwordReset(data)),

  // Admin
  sendAdminNewGuide: (data) =>
    send(ADMIN_EMAIL, `New guide registration — ${data.guideName}`, adminNewGuide(data)),

  sendAdminNewCompany: (data) =>
    send(ADMIN_EMAIL, `New company registration — ${data.companyName}`, adminNewCompany(data)),
};
