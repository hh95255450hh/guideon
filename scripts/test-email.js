/**
 * Send a bilingual test email (Arabic on top, English below) to verify
 * Resend + guideon.om domain + logo + anti-spam headers.
 * Usage: node scripts/test-email.js [recipient]
 */
require('dotenv').config();
const { Resend } = require('resend');

const TO        = process.argv[2] || 'Hh95255450hh@hotmail.com';
const FROM      = process.env.EMAIL_FROM     || 'Guideon <noreply@guideon.om>';
const REPLY_TO  = process.env.EMAIL_REPLY_TO || 'info@guideon.om';
const APP_URL   = process.env.APP_URL        || 'https://guideon.om';
const PUBLIC_URL= process.env.PUBLIC_URL     || 'https://guideon.om';
const LOGO_URL  = process.env.EMAIL_LOGO_URL || `${PUBLIC_URL}/logo.png`;

const html = `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#f0f4f3;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#1a1a1a">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f0f4f3;opacity:0">رسالة اختبار من Guideon لتأكيد عمل نظام البريد الإلكتروني.</div>

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

      <!-- ═══════════════ ARABIC (TOP) ═══════════════ -->
      <tr><td style="padding:36px 40px 16px" dir="rtl" lang="ar">
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#0f1c3e;text-align:right">
          نظام البريد الإلكتروني يعمل بنجاح
        </h1>
        <p style="margin:0 0 18px;font-size:15px;color:#444;line-height:1.85;text-align:right">
          مرحباً <strong style="color:#0f7b6c">هيثم</strong>،
        </p>
        <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.85;text-align:right">
          هذه رسالة اختبارية من منصة Guideon لتأكيد أن نظام البريد الإلكتروني تم تكوينه بشكل صحيح ويعمل بكفاءة.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
               style="border:1px solid #eaeef2;border-radius:10px;overflow:hidden;margin:20px 0;direction:rtl">
          <tr style="background:#f8faf9">
            <td colspan="2" style="padding:12px 18px;font-size:12px;color:#0f1c3e;font-weight:800;letter-spacing:1px;text-align:right;border-bottom:1px solid #eaeef2">
              تفاصيل التكوين
            </td>
          </tr>
          <tr>
            <td style="padding:12px 18px;font-size:13px;color:#777;width:140px;border-bottom:1px solid #f0f0f0;text-align:right">المُرسِل</td>
            <td style="padding:12px 18px;font-size:13px;color:#0f7b6c;font-weight:700;border-bottom:1px solid #f0f0f0;text-align:right" dir="ltr">noreply@guideon.om</td>
          </tr>
          <tr>
            <td style="padding:12px 18px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0;text-align:right">عنوان الرد</td>
            <td style="padding:12px 18px;font-size:13px;color:#0f7b6c;font-weight:700;border-bottom:1px solid #f0f0f0;text-align:right" dir="ltr">info@guideon.om</td>
          </tr>
          <tr>
            <td style="padding:12px 18px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0;text-align:right">مزود الخدمة</td>
            <td style="padding:12px 18px;font-size:13px;color:#1a1a1a;font-weight:600;border-bottom:1px solid #f0f0f0;text-align:right">Resend (طوكيو)</td>
          </tr>
          <tr>
            <td style="padding:12px 18px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0;text-align:right">الاستقبال</td>
            <td style="padding:12px 18px;font-size:13px;color:#1a1a1a;font-weight:600;border-bottom:1px solid #f0f0f0;text-align:right">Cloudflare Email Routing</td>
          </tr>
          <tr>
            <td style="padding:12px 18px;font-size:13px;color:#777;text-align:right">النطاق</td>
            <td style="padding:12px 18px;font-size:13px;color:#1a1a1a;font-weight:600;text-align:right" dir="ltr">guideon.om</td>
          </tr>
        </table>

        <div style="background:#e8f5f2;border:1px solid #b2d8ce;border-radius:10px;padding:16px 20px;margin:20px 0;text-align:right">
          <p style="margin:0;font-size:13px;color:#0f5c50;line-height:1.85">
            <strong>نصيحة:</strong> جرّب الضغط على زر "رد" (Reply) في هذه الرسالة — سيُوجَّه ردك تلقائياً إلى
            <span dir="ltr" style="font-weight:700">info@guideon.om</span> وسيصل إلى صندوق Hotmail الخاص بك خلال ثوانٍ.
          </p>
        </div>

        <p style="margin:24px 0 0;font-size:14px;color:#555;line-height:1.8;text-align:right">
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

      <!-- ═══════════════ ENGLISH (BOTTOM) ═══════════════ -->
      <tr><td style="padding:16px 40px 32px" dir="ltr" lang="en">
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#0f1c3e">
          Email system is working
        </h1>
        <p style="margin:0 0 18px;font-size:15px;color:#444;line-height:1.8">
          Hi <strong style="color:#0f7b6c">Haitham</strong>,
        </p>
        <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.8">
          This is a test email from Guideon to confirm that our email pipeline is configured correctly and running smoothly.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
               style="border:1px solid #eaeef2;border-radius:10px;overflow:hidden;margin:20px 0">
          <tr style="background:#f8faf9">
            <td colspan="2" style="padding:12px 18px;font-size:12px;color:#0f1c3e;font-weight:800;letter-spacing:1px;border-bottom:1px solid #eaeef2">
              CONFIGURATION
            </td>
          </tr>
          <tr>
            <td style="padding:12px 18px;font-size:13px;color:#777;width:140px;border-bottom:1px solid #f0f0f0">Sender</td>
            <td style="padding:12px 18px;font-size:13px;color:#0f7b6c;font-weight:700;border-bottom:1px solid #f0f0f0">noreply@guideon.om</td>
          </tr>
          <tr>
            <td style="padding:12px 18px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0">Reply-To</td>
            <td style="padding:12px 18px;font-size:13px;color:#0f7b6c;font-weight:700;border-bottom:1px solid #f0f0f0">info@guideon.om</td>
          </tr>
          <tr>
            <td style="padding:12px 18px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0">Provider</td>
            <td style="padding:12px 18px;font-size:13px;color:#1a1a1a;font-weight:600;border-bottom:1px solid #f0f0f0">Resend (Tokyo)</td>
          </tr>
          <tr>
            <td style="padding:12px 18px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0">Receiving</td>
            <td style="padding:12px 18px;font-size:13px;color:#1a1a1a;font-weight:600;border-bottom:1px solid #f0f0f0">Cloudflare Email Routing</td>
          </tr>
          <tr>
            <td style="padding:12px 18px;font-size:13px;color:#777">Domain</td>
            <td style="padding:12px 18px;font-size:13px;color:#1a1a1a;font-weight:600">guideon.om</td>
          </tr>
        </table>

        <div style="background:#e8f5f2;border:1px solid #b2d8ce;border-radius:10px;padding:16px 20px;margin:20px 0">
          <p style="margin:0;font-size:13px;color:#0f5c50;line-height:1.75">
            <strong>Tip:</strong> Try clicking "Reply" on this email — your response will be automatically routed to
            <strong>info@guideon.om</strong> and forwarded to your Hotmail inbox within seconds.
          </p>
        </div>

        <p style="margin:24px 0 0;font-size:14px;color:#555;line-height:1.7">
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
          <a href="mailto:info@guideon.om" style="color:#0f7b6c;text-decoration:none">info@guideon.om</a>
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

// Plain-text alternative — important for deliverability (multipart emails
// rank higher with spam filters than HTML-only).
const text = `Guideon — اختبار البريد الإلكتروني / Email Test

═══════════════════════════════════════════
العربية
═══════════════════════════════════════════

مرحباً هيثم،

هذه رسالة اختبارية من منصة Guideon لتأكيد أن نظام البريد الإلكتروني تم
تكوينه بشكل صحيح ويعمل بكفاءة.

تفاصيل التكوين:
- المُرسِل: noreply@guideon.om
- عنوان الرد: info@guideon.om
- مزود الخدمة: Resend (طوكيو)
- الاستقبال: Cloudflare Email Routing
- النطاق: guideon.om

نصيحة: جرّب الضغط على زر "رد" — سيُوجَّه ردك تلقائياً إلى info@guideon.om
ومنه إلى صندوق Hotmail الخاص بك.

مع أطيب التحيات،
فريق Guideon

═══════════════════════════════════════════
ENGLISH
═══════════════════════════════════════════

Hi Haitham,

This is a test email from Guideon to confirm that our email pipeline is
configured correctly and running smoothly.

Configuration:
- Sender:    noreply@guideon.om
- Reply-To:  info@guideon.om
- Provider:  Resend (Tokyo)
- Receiving: Cloudflare Email Routing
- Domain:    guideon.om

Tip: Try clicking "Reply" on this email — your response will be routed to
info@guideon.om and forwarded to your Hotmail inbox within seconds.

Best regards,
The Guideon Team

—
Guideon — Find Your Certified Local Guide in Oman
${APP_URL} · info@guideon.om · +968 9525 5450
Muscat, Sultanate of Oman · © ${new Date().getFullYear()} Guideon`;

(async () => {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes('REPLACE')) {
    console.error('RESEND_API_KEY missing from .env');
    process.exit(1);
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  console.log(`\nSending bilingual test email (Arabic top / English bottom)...`);
  console.log(`   From:     ${FROM}`);
  console.log(`   To:       ${TO}`);
  console.log(`   Reply-To: ${REPLY_TO}`);
  console.log(`   Logo:     ${LOGO_URL}\n`);

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: TO,
      subject: 'Welcome to Guideon — اختبار البريد الإلكتروني',
      html,
      text,
      reply_to: REPLY_TO,
      headers: {
        'List-Unsubscribe': '<mailto:unsubscribe@guideon.om?subject=Unsubscribe>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Entity-Ref-ID': `guideon-test-${Date.now()}`,
        'X-Mailer': 'Guideon Platform',
      },
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      process.exit(1);
    }

    console.log('Email sent successfully.');
    console.log(`   Email ID: ${result.data?.id || '(unknown)'}`);
    console.log(`\n   Check your inbox at ${TO}`);
    console.log(`   If you see it in Spam/Junk, mark it as "Not Junk" — this trains`);
    console.log(`   the filter and future emails will land in the Inbox directly.\n`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
