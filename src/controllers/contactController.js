/**
 * Contact form controller.
 * Sends user's message to info@guideon.guide + sends an auto-reply confirmation
 * to the user. Both emails are bilingual (EN + AR).
 */
const emailService = require('../services/emailService');

const CONTACT_INBOX = process.env.CONTACT_INBOX || 'info@guideon.guide';
const APP_URL       = process.env.APP_URL       || 'https://guideon.guide';

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

// ─── Email to staff (inbound message) ─────────────────────────────────────────
function staffNotificationHtml({ name, email, phone, subject, category, message }) {
  return `<!DOCTYPE html><html><body style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f8;margin:0;padding:24px">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#0f7b6c,#1abc9c);padding:24px 32px;color:#fff">
        <div style="font-size:24px;font-weight:800">📩 New Contact Message</div>
        <div style="font-size:12px;opacity:.85;margin-top:4px">via guideon.guide / Contact form</div>
      </td></tr>
      <tr><td style="padding:28px 32px">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:20px">
          <tr><td style="padding:10px 16px;font-size:13px;color:#777;width:120px;border-bottom:1px solid #f0f0f0">Name</td><td style="padding:10px 16px;font-size:13px;color:#1a1a1a;font-weight:600;border-bottom:1px solid #f0f0f0">${esc(name)}</td></tr>
          <tr><td style="padding:10px 16px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0">Email</td><td style="padding:10px 16px;font-size:13px;color:#0f7b6c;font-weight:600;border-bottom:1px solid #f0f0f0">${esc(email)}</td></tr>
          ${phone ? `<tr><td style="padding:10px 16px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0">Phone</td><td style="padding:10px 16px;font-size:13px;color:#1a1a1a;font-weight:600;border-bottom:1px solid #f0f0f0">${esc(phone)}</td></tr>` : ''}
          ${category ? `<tr><td style="padding:10px 16px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0">Category</td><td style="padding:10px 16px;font-size:13px;color:#1a1a1a;font-weight:600;border-bottom:1px solid #f0f0f0">${esc(category)}</td></tr>` : ''}
          <tr><td style="padding:10px 16px;font-size:13px;color:#777">Subject</td><td style="padding:10px 16px;font-size:13px;color:#1a1a1a;font-weight:600">${esc(subject)}</td></tr>
        </table>
        <h3 style="margin:0 0 8px;font-size:14px;color:#777;text-transform:uppercase;letter-spacing:1px">Message</h3>
        <div style="background:#f9fafb;border-left:4px solid #0f7b6c;padding:16px 20px;border-radius:0 8px 8px 0;font-size:14px;color:#333;line-height:1.7;white-space:pre-wrap">${esc(message)}</div>
        <p style="margin:20px 0 0;font-size:12px;color:#888">
          💡 Reply directly to this email — your response will be sent to <strong>${esc(email)}</strong>.
        </p>
      </td></tr>
      <tr><td style="background:#f8faf9;padding:14px 32px;text-align:center;border-top:1px solid #eee">
        <p style="margin:0;font-size:11px;color:#aaa">Guideon Contact Form · ${new Date().toISOString()}</p>
      </td></tr>
    </table></body></html>`;
}

// ─── Auto-reply to user (bilingual) ───────────────────────────────────────────
function autoReplyHtml({ name, subject }) {
  return `<!DOCTYPE html><html><body style="font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f3;margin:0;padding:24px">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.09)">
      <tr><td style="background:linear-gradient(135deg,#0f7b6c,#1abc9c);padding:30px 40px;text-align:center;color:#fff">
        <div style="font-size:30px;font-weight:800">🌿 Guideon</div>
        <div style="font-size:12px;opacity:.85;letter-spacing:1.5px;margin-top:4px">DISCOVER OMAN WITH A LOCAL GUIDE</div>
      </td></tr>

      <tr><td style="padding:32px 40px 16px">
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1a1a1a">Thanks for reaching out! ✉️</h1>
        <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.7">
          Hi <strong>${esc(name)}</strong>, we received your message about
          <em>"${esc(subject)}"</em> and our team will reply within <strong>24 hours</strong>
          (usually much faster during business hours).
        </p>
        <div style="background:#e8f5f2;border:1px solid #b2d8ce;border-radius:8px;padding:14px 18px;margin-bottom:16px">
          <p style="margin:0;font-size:13px;color:#0f5c50;line-height:1.6">
            📞 <strong>Need urgent help?</strong> Call us at <a href="tel:+96895255450" style="color:#0f5c50;font-weight:700">+968 9525 5450</a>
            or <a href="https://wa.me/96895255450" style="color:#0f5c50;font-weight:700">WhatsApp</a> us anytime.
          </p>
        </div>
      </td></tr>

      <tr><td style="padding:0 40px"><div style="border-top:2px dashed #e0e0e0;margin:8px 0"></div>
        <div style="text-align:center;color:#999;font-size:11px;letter-spacing:2px;margin:8px 0">─── العربية ───</div>
      </td></tr>

      <tr><td style="padding:16px 40px 28px" dir="rtl" lang="ar">
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1a1a1a;text-align:right">شكراً لتواصلك معنا ✉️</h1>
        <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.8;text-align:right">
          مرحباً <strong>${esc(name)}</strong>، استلمنا رسالتك حول
          <em>«${esc(subject)}»</em> وسيقوم فريقنا بالرد خلال <strong>24 ساعة</strong>
          (عادةً أسرع بكثير خلال ساعات العمل).
        </p>
        <div style="background:#e8f5f2;border:1px solid #b2d8ce;border-radius:8px;padding:14px 18px;text-align:right">
          <p style="margin:0;font-size:13px;color:#0f5c50;line-height:1.7">
            📞 <strong>تحتاج مساعدة عاجلة؟</strong> اتصل بنا على <a href="tel:+96895255450" style="color:#0f5c50;font-weight:700" dir="ltr">+968 9525 5450</a>
            أو راسلنا عبر <a href="https://wa.me/96895255450" style="color:#0f5c50;font-weight:700">واتساب</a> في أي وقت.
          </p>
        </div>
      </td></tr>

      <tr><td style="background:#f8faf9;border-top:1px solid #e8efed;padding:18px 40px;text-align:center">
        <p style="margin:0;font-size:12px;color:#aaa;line-height:1.7">
          Guideon — Find Your Certified Local Guide in Oman<br>
          <a href="${APP_URL}" style="color:#0f7b6c;text-decoration:none">guideon.guide</a> ·
          © ${new Date().getFullYear()} Guideon
        </p>
      </td></tr>
    </table></body></html>`;
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

    // 1) Send to staff inbox (info@guideon.guide)
    await emailService.send(
      CONTACT_INBOX,
      `[Contact] ${subject}`,
      staffNotificationHtml({ name, email, phone, subject, category, message })
    );

    // 2) Send auto-reply to user (best-effort, don't fail the request)
    try {
      await emailService.send(
        email,
        'We received your message ✓ — استلمنا رسالتك',
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
