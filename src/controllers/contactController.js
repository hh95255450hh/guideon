/**
 * Contact form controller.
 * Sends user's message to admin@guideon.om + sends an auto-reply confirmation
 * to the user. Both emails are bilingual: Arabic on top, English below.
 */
const emailService = require('../services/emailService');

const CONTACT_INBOX = process.env.CONTACT_INBOX || 'admin@guideon.om';
const APP_URL       = process.env.APP_URL       || 'https://guideon.om';
const PUBLIC_URL    = process.env.PUBLIC_URL    || 'https://guideon.om';
// Pin the email logo to the canonical https URL. Going through PUBLIC_URL/
// EMAIL_LOGO_URL env vars meant a single misconfigured value broke the logo in
// every email (the broken-image icon recipients reported).
const LOGO_URL      = 'https://guideon.om/logo.png?e=3';

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

// ─── Email to staff (inbound message) ─────────────────────────────────────────
function staffNotificationHtml({ name, email, phone, subject, category, message }) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:#f4f6f8;padding:24px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation"
             style="max-width:600px;width:100%;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.08)">
        <!-- Header with logo -->
        <tr><td style="background:linear-gradient(135deg,#0f1c3e 0%,#1a2c5b 50%,#0f7b6c 100%);padding:28px 32px;text-align:center;color:#fff">
          <img src="${LOGO_URL}" alt="Guideon" width="160" style="display:inline-block;max-width:160px;height:auto;border:0;margin-bottom:8px">
          <div style="font-size:18px;font-weight:800;margin-top:6px">New contact message</div>
          <div style="font-size:11px;opacity:.85;letter-spacing:1.5px;margin-top:4px">VIA GUIDEON.GUIDE</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                 style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:20px">
            <tr><td style="padding:10px 16px;font-size:13px;color:#777;width:120px;border-bottom:1px solid #f0f0f0">Name</td><td style="padding:10px 16px;font-size:13px;color:#1a1a1a;font-weight:600;border-bottom:1px solid #f0f0f0">${esc(name)}</td></tr>
            <tr><td style="padding:10px 16px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0">Email</td><td style="padding:10px 16px;font-size:13px;color:#0f7b6c;font-weight:600;border-bottom:1px solid #f0f0f0">${esc(email)}</td></tr>
            ${phone ? `<tr><td style="padding:10px 16px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0">Phone</td><td style="padding:10px 16px;font-size:13px;color:#1a1a1a;font-weight:600;border-bottom:1px solid #f0f0f0">${esc(phone)}</td></tr>` : ''}
            ${category ? `<tr><td style="padding:10px 16px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0">Category</td><td style="padding:10px 16px;font-size:13px;color:#1a1a1a;font-weight:600;border-bottom:1px solid #f0f0f0">${esc(category)}</td></tr>` : ''}
            <tr><td style="padding:10px 16px;font-size:13px;color:#777">Subject</td><td style="padding:10px 16px;font-size:13px;color:#1a1a1a;font-weight:600">${esc(subject)}</td></tr>
          </table>
          <h3 style="margin:0 0 8px;font-size:13px;color:#777;text-transform:uppercase;letter-spacing:1px">Message</h3>
          <div style="background:#f9fafb;border-left:4px solid #0f7b6c;padding:16px 20px;border-radius:0 8px 8px 0;font-size:14px;color:#333;line-height:1.7;white-space:pre-wrap">${esc(message)}</div>
          <p style="margin:20px 0 0;font-size:12px;color:#888">
            Reply directly to this email and your response will be sent to <strong>${esc(email)}</strong>.
          </p>
        </td></tr>

        <tr><td style="background:#f8faf9;padding:14px 32px;text-align:center;border-top:1px solid #eee">
          <p style="margin:0;font-size:11px;color:#aaa">Guideon Contact Form &middot; ${new Date().toISOString()}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ─── Auto-reply to user (bilingual — Arabic on TOP, English below) ────────────
function autoReplyHtml({ name, subject }) {
  const safeName    = esc(name);
  const safeSubject = esc(subject);
  return `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#f0f4f3;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#1a1a1a">
<!-- Preheader -->
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f0f4f3;opacity:0">استلمنا رسالتك وسنرد خلال 24 ساعة — We received your message and will reply within 24 hours.</div>

<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:#f0f4f3;padding:32px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation"
           style="max-width:600px;width:100%;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.09)">

      <!-- ─── HEADER with real logo ─── -->
      <tr><td style="background:linear-gradient(135deg,#0f1c3e 0%,#1a2c5b 50%,#0f7b6c 100%);padding:34px 40px;text-align:center">
        <img src="${LOGO_URL}" alt="Guideon" width="180" style="display:inline-block;max-width:180px;height:auto;border:0;outline:none;text-decoration:none">
        <div style="color:rgba(255,255,255,0.88);font-size:11px;letter-spacing:2.5px;margin-top:10px;font-weight:600">
          اكتشف عُمان مع مرشد محلي &middot; DISCOVER OMAN WITH A LOCAL GUIDE
        </div>
      </td></tr>

      <!-- ═════════════════════════════════════════════ -->
      <!-- ═══════════  ARABIC (TOP)  ═════════════════ -->
      <!-- ═════════════════════════════════════════════ -->
      <tr><td style="padding:36px 40px 16px" dir="rtl" lang="ar">
        <h1 style="margin:0 0 12px;font-size:23px;font-weight:800;color:#0f1c3e;text-align:right">
          شكراً لتواصلك معنا
        </h1>
        <p style="margin:0 0 18px;font-size:15px;color:#444;line-height:1.85;text-align:right">
          مرحباً <strong style="color:#0f7b6c">${safeName}</strong>،
        </p>
        <p style="margin:0 0 18px;font-size:15px;color:#444;line-height:1.85;text-align:right">
          استلمنا رسالتك بخصوص <em style="color:#0f1c3e;font-weight:600">«${safeSubject}»</em>
          وسيقوم فريقنا بالرد عليك خلال <strong>24 ساعة</strong> (عادةً أسرع بكثير خلال ساعات العمل من الأحد إلى الخميس).
        </p>

        <div style="background:#e8f5f2;border:1px solid #b2d8ce;border-radius:10px;padding:16px 20px;text-align:right;margin:18px 0">
          <p style="margin:0 0 6px;font-size:13px;color:#0f5c50;line-height:1.8;font-weight:700">
            هل تحتاج مساعدة عاجلة؟
          </p>
          <p style="margin:0;font-size:13px;color:#0f5c50;line-height:1.9">
            &middot; اتصل بنا: <a href="tel:+96895255450" style="color:#0f5c50;font-weight:700;text-decoration:none" dir="ltr">+968 9525 5450</a><br>
            &middot; راسلنا على واتساب: <a href="https://wa.me/96895255450" style="color:#0f5c50;font-weight:700;text-decoration:none">واتساب مباشر</a><br>
            &middot; ساعات العمل: الأحد - الخميس، 8 صباحاً - 8 مساءً (بتوقيت عُمان)
          </p>
        </div>

        <p style="margin:18px 0 0;font-size:14px;color:#555;line-height:1.8;text-align:right">
          مع أطيب التحيات،<br>
          <strong style="color:#0f1c3e">فريق Guideon</strong>
        </p>
      </td></tr>

      <!-- ─── Divider ─── -->
      <tr><td style="padding:8px 40px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
          <tr>
            <td style="border-top:1px solid #e8efed;height:1px;font-size:0;line-height:0">&nbsp;</td>
            <td style="width:60px;text-align:center;color:#aaa;font-size:10px;letter-spacing:2px;padding:0 8px">ENGLISH</td>
            <td style="border-top:1px solid #e8efed;height:1px;font-size:0;line-height:0">&nbsp;</td>
          </tr>
        </table>
      </td></tr>

      <!-- ═════════════════════════════════════════════ -->
      <!-- ═══════════  ENGLISH (BOTTOM)  ═════════════ -->
      <!-- ═════════════════════════════════════════════ -->
      <tr><td style="padding:16px 40px 32px" dir="ltr" lang="en">
        <h1 style="margin:0 0 12px;font-size:23px;font-weight:800;color:#0f1c3e">
          Thank you for contacting us
        </h1>
        <p style="margin:0 0 18px;font-size:15px;color:#444;line-height:1.8">
          Hi <strong style="color:#0f7b6c">${safeName}</strong>,
        </p>
        <p style="margin:0 0 18px;font-size:15px;color:#444;line-height:1.8">
          We've received your message regarding <em style="color:#0f1c3e;font-weight:600">"${safeSubject}"</em>
          and our team will reply within <strong>24 hours</strong> (usually much faster during business hours, Sunday to Thursday).
        </p>

        <div style="background:#e8f5f2;border:1px solid #b2d8ce;border-radius:10px;padding:16px 20px;margin:18px 0">
          <p style="margin:0 0 6px;font-size:13px;color:#0f5c50;line-height:1.7;font-weight:700">
            Need urgent help?
          </p>
          <p style="margin:0;font-size:13px;color:#0f5c50;line-height:1.8">
            &middot; Call us: <a href="tel:+96895255450" style="color:#0f5c50;font-weight:700;text-decoration:none">+968 9525 5450</a><br>
            &middot; WhatsApp: <a href="https://wa.me/96895255450" style="color:#0f5c50;font-weight:700;text-decoration:none">Open chat</a><br>
            &middot; Hours: Sunday - Thursday, 8 AM - 8 PM (Oman time)
          </p>
        </div>

        <p style="margin:18px 0 0;font-size:14px;color:#555;line-height:1.7">
          Best regards,<br>
          <strong style="color:#0f1c3e">The Guideon Team</strong>
        </p>
      </td></tr>

      <!-- ─── FOOTER ─── -->
      <tr><td style="background:#f8faf9;border-top:1px solid #e8efed;padding:24px 40px;text-align:center">
        <p style="margin:0 0 8px;font-size:13px;color:#666;line-height:1.7;font-weight:600">
          Guideon &mdash; Find Your Certified Local Guide in Oman
        </p>
        <p style="margin:0 0 10px;font-size:12px;color:#888;line-height:1.7">
          <a href="${APP_URL}" style="color:#0f7b6c;text-decoration:none;font-weight:600">guideon.om</a>
          &nbsp;&middot;&nbsp;
          <a href="mailto:admin@guideon.om" style="color:#0f7b6c;text-decoration:none">admin@guideon.om</a>
          &nbsp;&middot;&nbsp;
          <a href="tel:+96895255450" style="color:#0f7b6c;text-decoration:none">+968 9525 5450</a>
        </p>
        <p style="margin:0;font-size:11px;color:#aaa">
          Muscat, Sultanate of Oman &nbsp;&middot;&nbsp; &copy; ${new Date().getFullYear()} Guideon. All rights reserved.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ─── POST /api/contact/send ───────────────────────────────────────────────────
exports.send = async (req, res) => {
  try {
    const { name, email, phone, subject, category, message } = req.body || {};

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, subject and message are required.',
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'A valid email is required.' });
    }
    if (message.length > 5000) {
      return res.status(400).json({ success: false, message: 'Message is too long (max 5000 chars).' });
    }

    // 1) Send to staff inbox (admin@guideon.om)
    await emailService.send(
      CONTACT_INBOX,
      `Contact form: ${subject}`,
      staffNotificationHtml({ name, email, phone, subject, category, message })
    );

    // 2) Send bilingual auto-reply to user (best-effort, don't fail the request)
    try {
      await emailService.send(
        email,
        'We received your message — استلمنا رسالتك',
        autoReplyHtml({ name, subject })
      );
    } catch (_) { /* non-fatal */ }

    res.json({
      success: true,
      message: 'Your message has been sent. We\'ll reply within 24 hours.',
    });
  } catch (err) {
    console.error('[contact] send error:', err);
    res.status(500).json({ success: false, message: 'Failed to send message. Please try again.' });
  }
};
