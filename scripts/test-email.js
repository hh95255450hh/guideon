/**
 * Send a bilingual test email to verify Resend + guideon.guide domain.
 * Usage: node scripts/test-email.js
 */
require('dotenv').config();
const { Resend } = require('resend');

const TO        = process.argv[2] || 'Hh95255450hh@hotmail.com';
const FROM      = 'Guideon <noreply@guideon.guide>';
const REPLY_TO  = 'info@guideon.guide';
const APP_URL   = process.env.APP_URL || 'https://guideon.guide';

const html = `<!DOCTYPE html>
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
          <div style="color:rgba(255,255,255,0.85);font-size:12px;letter-spacing:1.5px;margin-top:4px;">
            DISCOVER OMAN WITH A LOCAL GUIDE
          </div>
        </td>
      </tr>

      <!-- English -->
      <tr><td style="padding:36px 40px 12px;">
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;">
          ✅ Email System Working!
        </h1>
        <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.7;">
          Hi <strong>Haitham</strong>, this is a test email from <strong>Guideon</strong> sent through
          our newly-configured production pipeline:
        </p>

        <table width="100%" cellpadding="0" cellspacing="0"
          style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:20px;">
          <tr>
            <td style="padding:10px 16px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0;width:160px;">Sender Domain</td>
            <td style="padding:10px 16px;font-size:13px;color:#0f7b6c;font-weight:700;border-bottom:1px solid #f0f0f0;">noreply@guideon.guide ✅</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0;">Reply-To</td>
            <td style="padding:10px 16px;font-size:13px;color:#0f7b6c;font-weight:700;border-bottom:1px solid #f0f0f0;">info@guideon.guide ✅</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0;">Provider</td>
            <td style="padding:10px 16px;font-size:13px;color:#1a1a1a;font-weight:600;border-bottom:1px solid #f0f0f0;">Resend (Tokyo region)</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0;">Receiving</td>
            <td style="padding:10px 16px;font-size:13px;color:#1a1a1a;font-weight:600;border-bottom:1px solid #f0f0f0;">Cloudflare Email Routing</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;font-size:13px;color:#777;">Domain</td>
            <td style="padding:10px 16px;font-size:13px;color:#1a1a1a;font-weight:600;">guideon.guide</td>
          </tr>
        </table>

        <div style="background:#e8f5f2;border:1px solid #b2d8ce;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
          <p style="margin:0;font-size:13px;color:#0f5c50;line-height:1.6;">
            💡 <strong>Tip:</strong> Try clicking "Reply" on this email — your response will be
            routed to <code>info@guideon.guide</code> and forwarded to your Hotmail inbox.
          </p>
        </div>

        <div style="text-align:center;margin:24px 0 8px;">
          <a href="${APP_URL}" style="background:#0f7b6c;color:#fff;text-decoration:none;
             padding:14px 36px;border-radius:8px;font-size:14px;font-weight:700;display:inline-block;">
            Visit guideon.guide
          </a>
        </div>
      </td></tr>

      <!-- Divider -->
      <tr><td style="padding:0 40px;">
        <div style="border-top:2px dashed #e0e0e0;margin:8px 0;"></div>
        <div style="text-align:center;color:#999;font-size:11px;letter-spacing:2px;margin:8px 0;">
          ─── العربية ───
        </div>
      </td></tr>

      <!-- Arabic -->
      <tr><td style="padding:12px 40px 28px;" dir="rtl" lang="ar">
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a1a;text-align:right;">
          ✅ نظام البريد الإلكتروني يعمل!
        </h1>
        <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.8;text-align:right;">
          مرحباً <strong>هيثم</strong>، هذا إيميل تجريبي من منصة <strong>Guideon</strong> أُرسل عبر
          النظام الجديد الذي تم إعداده للتو:
        </p>

        <table width="100%" cellpadding="0" cellspacing="0"
          style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:20px;direction:rtl;">
          <tr>
            <td style="padding:10px 16px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0;width:160px;text-align:right;">المُرسِل</td>
            <td style="padding:10px 16px;font-size:13px;color:#0f7b6c;font-weight:700;border-bottom:1px solid #f0f0f0;text-align:right;" dir="ltr">noreply@guideon.guide ✅</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0;text-align:right;">عنوان الرد</td>
            <td style="padding:10px 16px;font-size:13px;color:#0f7b6c;font-weight:700;border-bottom:1px solid #f0f0f0;text-align:right;" dir="ltr">info@guideon.guide ✅</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0;text-align:right;">مزود الخدمة</td>
            <td style="padding:10px 16px;font-size:13px;color:#1a1a1a;font-weight:600;border-bottom:1px solid #f0f0f0;text-align:right;">Resend (منطقة طوكيو)</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;font-size:13px;color:#777;border-bottom:1px solid #f0f0f0;text-align:right;">الاستقبال</td>
            <td style="padding:10px 16px;font-size:13px;color:#1a1a1a;font-weight:600;border-bottom:1px solid #f0f0f0;text-align:right;">Cloudflare Email Routing</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;font-size:13px;color:#777;text-align:right;">النطاق</td>
            <td style="padding:10px 16px;font-size:13px;color:#1a1a1a;font-weight:600;text-align:right;" dir="ltr">guideon.guide</td>
          </tr>
        </table>

        <div style="background:#e8f5f2;border:1px solid #b2d8ce;border-radius:8px;padding:14px 18px;margin-bottom:20px;text-align:right;">
          <p style="margin:0;font-size:13px;color:#0f5c50;line-height:1.7;">
            💡 <strong>نصيحة:</strong> جرّب الضغط على زر "رد" (Reply) في هذا الإيميل — ردّك سيُوجَّه
            تلقائياً إلى <code dir="ltr">info@guideon.guide</code> ومنه إلى صندوق Hotmail الخاص بك.
          </p>
        </div>

        <p style="margin:16px 0 0;font-size:13px;color:#0f7b6c;text-align:center;font-weight:700;">
          🎉 كل شيء جاهز للانطلاق!
        </p>
      </td></tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8faf9;border-top:1px solid #e8efed;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#aaa;line-height:1.7;">
            Guideon — Find Your Certified Local Guide in Oman<br>
            <a href="${APP_URL}" style="color:#0f7b6c;text-decoration:none;">guideon.guide</a>
            &nbsp;·&nbsp;
            © ${new Date().getFullYear()} Guideon. All rights reserved.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;

(async () => {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes('REPLACE')) {
    console.error('❌ RESEND_API_KEY missing from .env');
    process.exit(1);
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  console.log(`\n📧 Sending test email...`);
  console.log(`   From:     ${FROM}`);
  console.log(`   To:       ${TO}`);
  console.log(`   Reply-To: ${REPLY_TO}`);
  console.log(`   Subject:  ✅ Guideon Email Test / اختبار البريد الإلكتروني\n`);

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: TO,
      subject: '✅ Guideon Email Test — اختبار البريد الإلكتروني',
      html,
      reply_to: REPLY_TO,
    });

    if (result.error) {
      console.error('❌ Resend error:', result.error);
      process.exit(1);
    }

    console.log('✅ Email sent successfully!');
    console.log(`   Email ID: ${result.data?.id || '(unknown)'}`);
    console.log(`\n   Check your inbox at ${TO}`);
    console.log(`   If not in inbox, check Spam/Junk folder.\n`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
