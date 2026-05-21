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

const FROM    = process.env.EMAIL_FROM  || 'Guideon <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL     || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@Guideon.om';

// ── Layout ────────────────────────────────────────────────────────────────────
function layout(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f3;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f3;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0"
           style="background:#fff;border-radius:14px;overflow:hidden;
                  box-shadow:0 4px 16px rgba(0,0,0,0.09);max-width:600px;width:100%;">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#0f7b6c,#1abc9c);padding:30px 40px;text-align:center;">
          <div style="font-size:30px;font-weight:800;color:#fff;letter-spacing:-1px;">
            🌿 Guideon
          </div>
          <div style="color:rgba(255,255,255,0.8);font-size:12px;letter-spacing:1.5px;margin-top:4px;">
            DISCOVER OMAN WITH A LOCAL GUIDE
          </div>
        </td>
      </tr>

      <!-- Body -->
      <tr><td style="padding:36px 40px 28px;">${body}</td></tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8faf9;border-top:1px solid #e8efed;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#aaa;line-height:1.7;">
            Guideon — Find Your Certified Local Guide in Oman<br>
            <a href="${APP_URL}" style="color:#0f7b6c;text-decoration:none;">guideon.om</a>
            &nbsp;·&nbsp;
            © ${new Date().getFullYear()} Guideon. All rights reserved.
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

// ══════════════════════════════════════════════════════════════════════════════
//  TOURIST EMAILS
// ══════════════════════════════════════════════════════════════════════════════

function touristWelcome({ name }) {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">Welcome to Guideon! 🌿</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      Hi <strong>${name}</strong>, your account is ready. Explore Oman with a certified local guide —
      from the deserts of Wahiba Sands to the fjords of Musandam.
    </p>
    ${btn('Find a Guide', `${APP_URL}/search.html`)}
    <p style="margin:16px 0 0;font-size:13px;color:#888;text-align:center;line-height:1.6;">
      Need help? Just reply to this email — we're here for you.
    </p>
  `);
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
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">Welcome to Guideon! 🌿</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      Hi <strong>${name}</strong>, your guide account has been created. Our team will review
      and verify your licence shortly. You'll receive an email once approved.
    </p>
    <div style="background:#e8f5f2;border:1px solid #b2d8ce;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#0f5c50;line-height:1.6;">
        📋 <strong>Next steps:</strong> Complete your profile, add your availability, and wait for verification.
        Once verified, tourists can find and book you.
      </p>
    </div>
    ${btn('Complete My Profile', `${APP_URL}/guide-dashboard.html`)}
  `);
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
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">You're Verified! 🎉</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      Congratulations <strong>${name}</strong>! Your guide account has been verified by the Guideon team.
      You are now visible to tourists and can start receiving bookings.
    </p>
    ${badge('✓ VERIFIED GUIDE', '#0f7b6c', '#e8f5f2')}
    <div style="background:#e8f5f2;border:1px solid #b2d8ce;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#0f5c50;line-height:1.6;">
        🗓️ <strong>Add your availability</strong> so tourists can book your tours.
      </p>
    </div>
    ${btn('Set My Availability', `${APP_URL}/guide-dashboard.html`)}
  `);
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

function companyWelcome({ name, companyName }) {
  return layout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">Welcome to Guideon! 🏢</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      Hi <strong>${name}</strong>, your company account for <strong>${companyName}</strong> has been created.
      Our team will review your profile before it goes live to tourists.
    </p>
    <div style="background:#e8f0ff;border:1px solid #b0c4f5;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#1a3a7a;line-height:1.6;">
        📋 <strong>Next steps:</strong> Complete your company profile, add your tour packages and services.
        Once reviewed, tourists can discover and contact your company.
      </p>
    </div>
    ${btn('Go to Company Dashboard', `${APP_URL}/company-dashboard.html`)}
  `);
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
async function send(to, subject, html) {
  const resend = getResend();
  if (!resend) {
    console.log(`[Email] Skipped (no API key): ${subject} → ${to}`);
    return;
  }
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) console.error(`[Email] Failed: ${subject} → ${to}:`, error.message);
    else console.log(`[Email] Sent: ${subject} → ${to}`);
  } catch (err) {
    console.error(`[Email] Error: ${subject} → ${to}:`, err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════════════════════════════════════════
module.exports = {
  // Tourist
  sendTouristWelcome: (data) =>
    send(data.email, 'Welcome to Guideon! 🌿', touristWelcome(data)),

  sendTouristBookingPending: (data) =>
    send(data.email, `Booking Request Sent — ${data.destination}`, touristBookingPending(data)),

  sendTouristBookingConfirmed: (data) =>
    send(data.email, `Booking Confirmed — ${data.destination} 🎉`, touristBookingConfirmed(data)),

  sendTouristBookingCancelled: (data) =>
    send(data.email, `Booking Cancelled — ${data.destination}`, touristBookingCancelled(data)),

  sendTouristReviewReminder: (data) =>
    send(data.email, `How was your tour with ${data.guideName}? ⭐`, touristReviewReminder(data)),

  // Guide
  sendGuideWelcome: (data) =>
    send(data.email, 'Welcome to Guideon — Account Created 🌿', guideWelcome(data)),

  sendGuideNewBooking: (data) =>
    send(data.email, `New Booking Request — ${data.destination} 📩`, guideNewBooking(data)),

  sendGuideBookingConfirmed: (data) =>
    send(data.email, `Booking Confirmed — ${data.destination}`, guideBookingConfirmed(data)),

  sendGuideBookingCancelled: (data) =>
    send(data.email, `Booking Cancelled — ${data.destination}`, guideBookingCancelled(data)),

  sendGuideVerified: (data) =>
    send(data.email, 'Your Guideon Account is Verified! 🎉', guideVerified(data)),

  sendGuideNewReview: (data) =>
    send(data.email, `New Review from ${data.touristName} ${('⭐').repeat(data.rating)}`, guideNewReview(data)),

  // Company
  sendCompanyWelcome: (data) =>
    send(data.email, 'Welcome to Guideon — Company Account Created 🏢', companyWelcome(data)),

  // Admin
  sendAdminNewGuide: (data) =>
    send(ADMIN_EMAIL, `New Guide Registration — ${data.guideName}`, adminNewGuide(data)),

  sendAdminNewCompany: (data) =>
    send(ADMIN_EMAIL, `New Company Registration — ${data.companyName}`, adminNewCompany(data)),
};
