const { Resend } = require('resend');

let _resend = null;
function getResend() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set in environment variables');
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM = process.env.EMAIL_FROM || 'OmanExplorer <noreply@omanexplorer.com>';

// ── Shared layout ─────────────────────────────────────────────────────────────
function layout(bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OmanExplorer</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#1a6b4a;padding:28px 40px;text-align:center;">
            <span style="font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
              🌴 OmanExplorer
            </span>
            <p style="color:#a8d5be;margin:4px 0 0;font-size:13px;letter-spacing:0.5px;">
              DISCOVER THE SULTANATE
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            ${bodyContent}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;border-top:1px solid #eeeeee;
                     padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.6;">
              You received this email because you have a booking with OmanExplorer.<br/>
              © ${new Date().getFullYear()} OmanExplorer. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Reusable detail row ───────────────────────────────────────────────────────
function detailRow(label, value) {
  return `
    <tr>
      <td style="padding:10px 16px;font-size:13px;color:#666666;
                 border-bottom:1px solid #f0f0f0;width:140px;">${label}</td>
      <td style="padding:10px 16px;font-size:13px;color:#1a1a1a;
                 border-bottom:1px solid #f0f0f0;font-weight:600;">${value}</td>
    </tr>`;
}

// ── Templates ─────────────────────────────────────────────────────────────────
function confirmationHtml({ name, tourTitle, date, participants, totalPrice, bookingId }) {
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const formattedPrice = parseFloat(totalPrice).toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
  });

  return layout(`
    <!-- Greeting -->
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1a1a1a;">
      Booking Confirmed! 🎉
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#555555;line-height:1.6;">
      Hi <strong>${name}</strong>, great news — your tour is booked and ready to go.
    </p>

    <!-- Status badge -->
    <div style="background:#e8f5ee;border:1px solid #b2dfca;border-radius:8px;
                padding:12px 20px;margin-bottom:28px;display:inline-block;">
      <span style="color:#1a6b4a;font-weight:700;font-size:14px;">✓ CONFIRMED</span>
    </div>

    <!-- Details table -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #eeeeee;border-radius:8px;overflow:hidden;margin-bottom:28px;">
      ${detailRow('Tour', tourTitle)}
      ${detailRow('Date', formattedDate)}
      ${detailRow('Participants', participants)}
      ${detailRow('Total Paid', formattedPrice)}
      ${detailRow('Booking ID', `<span style="font-family:monospace;font-size:12px;">${bookingId}</span>`)}
    </table>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${process.env.APP_URL || 'http://localhost:3000'}/bookings"
         style="background:#1a6b4a;color:#ffffff;text-decoration:none;
                padding:14px 32px;border-radius:8px;font-size:14px;
                font-weight:600;display:inline-block;">
        View My Bookings
      </a>
    </div>

    <p style="margin:0;font-size:13px;color:#888888;line-height:1.6;text-align:center;">
      Need help? Reply to this email and our team will assist you.
    </p>
  `);
}

function cancellationHtml({ name, tourTitle, bookingId }) {
  return layout(`
    <!-- Greeting -->
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1a1a1a;">
      Booking Cancelled
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#555555;line-height:1.6;">
      Hi <strong>${name}</strong>, your booking has been cancelled as requested.
    </p>

    <!-- Status badge -->
    <div style="background:#fff3f3;border:1px solid #ffbbbb;border-radius:8px;
                padding:12px 20px;margin-bottom:28px;display:inline-block;">
      <span style="color:#cc0000;font-weight:700;font-size:14px;">✕ CANCELLED</span>
    </div>

    <!-- Details table -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #eeeeee;border-radius:8px;overflow:hidden;margin-bottom:28px;">
      ${detailRow('Tour', tourTitle)}
      ${detailRow('Booking ID', `<span style="font-family:monospace;font-size:12px;">${bookingId}</span>`)}
    </table>

    <!-- Refund notice -->
    <div style="background:#fffbea;border:1px solid #ffe58a;border-radius:8px;
                padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0;font-size:13px;color:#7a6300;line-height:1.6;">
        💳 <strong>Refund:</strong> If you paid for this booking, a full refund will be
        processed to your original payment method within <strong>5–10 business days</strong>.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${process.env.APP_URL || 'http://localhost:3000'}"
         style="background:#1a6b4a;color:#ffffff;text-decoration:none;
                padding:14px 32px;border-radius:8px;font-size:14px;
                font-weight:600;display:inline-block;">
        Browse More Tours
      </a>
    </div>

    <p style="margin:0;font-size:13px;color:#888888;line-height:1.6;text-align:center;">
      We hope to see you on an adventure soon!
    </p>
  `);
}

// ── Public API ────────────────────────────────────────────────────────────────
const sendBookingConfirmation = async ({ email, name, tourTitle, date, participants, totalPrice, bookingId }) => {
  const { error } = await getResend().emails.send({
    from:    FROM,
    to:      email,
    subject: `Booking Confirmed – ${tourTitle} 🎉`,
    html:    confirmationHtml({ name, tourTitle, date, participants, totalPrice, bookingId }),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
};

const sendBookingCancellation = async ({ email, name, tourTitle, bookingId }) => {
  const { error } = await getResend().emails.send({
    from:    FROM,
    to:      email,
    subject: `Booking Cancelled – ${tourTitle}`,
    html:    cancellationHtml({ name, tourTitle, bookingId }),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
};

module.exports = { sendBookingConfirmation, sendBookingCancellation };
