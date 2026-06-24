/**
 * Guide accounting endpoints — wallet, earnings ledger, invoices & statements.
 * Earnings are derived from the guide's own bookings; no extra table required.
 *
 * Wallet model:
 *   pending   = paid bookings whose tour isn't completed yet (money in flight)
 *   available = paid + completed bookings not yet paid out
 *   paidOut   = bookings carrying a paidOutAt timestamp (optional column)
 */
const SupabaseDB = require('../models/SupabaseDB');
const invoice = require('../services/invoiceService');
const commission = require('../services/commission');
const emailService = require('../services/emailService');

const bookings = new SupabaseDB('bookings');
const users    = new SupabaseDB('users');

const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

// Resilient write: drop the column & retry if a not-yet-migrated field is hit.
const OPTIONAL_BK_COLS = ['payoutRequestedAt'];
async function updateBookingSafe(id, patch) {
  try { return await bookings.update(id, patch); }
  catch (e) {
    if (/Could not find the '\w+' column|column \S+ does not exist|schema cache/i.test(e.message || '')) {
      const clean = { ...patch }; OPTIONAL_BK_COLS.forEach(c => delete clean[c]);
      return Object.keys(clean).length ? await bookings.update(id, clean) : null;
    }
    throw e;
  }
}

// GET /api/guides/me/earnings — wallet + ledger
exports.earnings = async (req, res) => {
  try {
    const guideId = req.session.userId;
    const me    = await users.findById(guideId);
    const RATES = await commission.getRates();
    const rate  = commission.rateFor(me, RATES);     // this provider's rate
    const vat   = RATES.vat;
    const mine = (await bookings.findAllByField('guideId', guideId))
      .filter(b => b.totalAmount != null);

    const paid = mine.filter(b => b.isPaid);
    const sum  = (arr) => r3(arr.reduce((s, b) => s + invoice.breakdown(b, rate, vat).net, 0));

    const completedPaid = paid.filter(b => b.status === 'completed' && !b.paidOutAt);
    const inFlight      = paid.filter(b => b.status !== 'completed' && !b.paidOutAt);
    const settled       = paid.filter(b => b.paidOutAt);

    const wallet = {
      pending:   sum(inFlight),         // tour not finished → held
      available: sum(completedPaid),    // earned, awaiting payout
      paidOut:   sum(settled),          // already transferred
      lifetimeNet:   sum(paid),
      lifetimeGross: r3(paid.reduce((s, b) => s + (parseFloat(b.totalAmount) || 0), 0)),
      bookingsPaid:  paid.length,
      commissionRate: rate,
      vatRate:        vat,
    };

    // Ledger (latest 100), each row with the full money breakdown.
    const ledger = paid
      .slice()
      .sort((a, b) => new Date(b.paidAt || b.createdAt) - new Date(a.paidAt || a.createdAt))
      .slice(0, 100)
      .map(b => {
        const br = invoice.breakdown(b, rate, vat);
        return {
          id: b.id,
          invoiceNo: invoice.invoiceNumber(b),
          date: b.paidAt || b.createdAt,
          destination: b.destination || '—',
          status: b.status,
          settled: !!b.paidOutAt,
          paidOutAt: b.paidOutAt || null,
          requested: !!b.payoutRequestedAt,
          requestedAt: b.payoutRequestedAt || null,
          ...br,
        };
      });

    // Months that have payable bookings, for the statement dropdown.
    const months = [...new Set(paid.map(b => {
      const d = new Date(b.paidAt || b.createdAt);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }))].sort().reverse();

    res.json({ success: true, currency: 'OMR', wallet, ledger, months });
  } catch (err) {
    console.error('[accounting:earnings]', err.message);
    res.status(500).json({ success: false, message: "Couldn't load earnings. — تعذّر تحميل الأرباح." });
  }
};

// POST /api/guides/me/request-payout/:bookingId — provider asks the platform to
// pay an earned-but-unsettled invoice (in case a transfer was forgotten).
exports.requestPayout = async (req, res) => {
  try {
    const providerId = req.session.userId;
    const b = await bookings.findById(req.params.bookingId);
    if (!b || b.guideId !== providerId) {
      return res.status(404).json({ success: false, message: 'Booking not found. — الحجز غير موجود.' });
    }
    if (!b.isPaid || b.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Payment can only be requested for completed, paid tours. — يمكن طلب الدفع للرحلات المكتملة والمدفوعة فقط.' });
    }
    if (b.paidOutAt) {
      return res.status(400).json({ success: false, message: 'This payout was already transferred. — تمّ تحويل مستحقّ هذه الفاتورة بالفعل.' });
    }
    if (b.payoutRequestedAt) {
      return res.json({ success: true, alreadyRequested: true, requestedAt: b.payoutRequestedAt, message: 'You already requested this payout. — سبق أن أرسلت طلب الدفع لهذه الفاتورة.' });
    }

    const now = new Date().toISOString();
    await updateBookingSafe(req.params.bookingId, { payoutRequestedAt: now });

    // Alert the platform owner/staff so they can settle it.
    try {
      const me = await users.findById(providerId);
      const R  = await commission.getRates();
      const br = invoice.breakdown(b, commission.rateFor(me, R), R.vat);
      const who = me?.companyName || me?.fullName || 'مزوّد';
      const invNo = invoice.invoiceNumber(b);
      const html = emailService.notificationEmail({
        icon: '💸',
        title:   `Payout requested by ${who}`,
        titleAr: `طلب صرف مستحقّ من ${who}`,
        body:    `Invoice ${invNo} · net ${br.net.toFixed(3)} OMR · booking ${b.id}`,
        bodyAr:  `الفاتورة ${invNo} · الصافي ${br.net.toFixed(3)} ر.ع · الحجز ${b.id}${b.destination ? ' — ' + b.destination : ''}`,
        link: '/admin-revenue.html',
      });
      emailService.notifyAdmins(`[Guideon] 💸 طلب دفع مستحقّ — ${who}`, html);
    } catch (_) { /* never fail the request because the alert failed */ }

    return res.json({ success: true, requestedAt: now, message: 'Payment request sent to the platform. — تمّ إرسال طلب الدفع إلى المنصّة، وسيتمّ التحويل قريباً.' });
  } catch (err) {
    console.error('[accounting:requestPayout]', err.message);
    res.status(500).json({ success: false, message: "Couldn't send the request. — تعذّر إرسال طلب الدفع." });
  }
};

// GET /api/guides/me/invoice/:bookingId — earnings invoice PDF for one booking
exports.invoicePdf = async (req, res) => {
  try {
    const guideId = req.session.userId;
    const booking = await bookings.findById(req.params.bookingId);
    if (!booking || booking.guideId !== guideId) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    const [guide, tourist] = await Promise.all([
      users.findById(guideId),
      booking.touristId ? users.findById(booking.touristId) : null,
    ]);
    const R = await commission.getRates();
    const pdf = await invoice.generateGuideInvoice(booking, guide, tourist, commission.rateFor(guide, R), R.vat, R.vatNumber);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${invoice.invoiceNumber(booking)}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('[accounting:invoicePdf]', err.message);
    res.status(500).json({ success: false, message: "Couldn't generate the invoice. — تعذّر إصدار الفاتورة." });
  }
};

// GET /api/guides/me/statement?month=YYYY-MM — monthly payout statement PDF
exports.statementPdf = async (req, res) => {
  try {
    const guideId = req.session.userId;
    const ym = String(req.query.month || '').match(/^\d{4}-\d{2}$/) ? req.query.month
             : new Date().toISOString().slice(0, 7);

    const guide = await users.findById(guideId);
    const mine = (await bookings.findAllByField('guideId', guideId))
      .filter(b => b.isPaid && b.totalAmount != null)
      .filter(b => {
        const d = new Date(b.paidAt || b.createdAt);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}` === ym;
      });

    const R = await commission.getRates();
    const pdf = await invoice.generateStatement(guide, mine, ym, commission.rateFor(guide, R), R.vat);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="guideon-statement-${ym}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('[accounting:statementPdf]', err.message);
    res.status(500).json({ success: false, message: "Couldn't generate the statement. — تعذّر إصدار الكشف." });
  }
};

// GET /invoice/verify/:token — public, minimal invoice authenticity check
exports.verify = async (req, res) => {
  const bookingId = invoice.decodeToken(req.params.token);
  const page = (ok, body) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice verification — Guideon</title>
<link rel="icon" href="/favicon.ico">
<style>body{font-family:'Segoe UI',system-ui,sans-serif;background:#eef2f7;margin:0;padding:40px 16px;color:#0f1c3e}
.card{max-width:460px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(15,28,62,.12);overflow:hidden}
.hd{background:linear-gradient(135deg,#0a5c50,#0f7b6c);color:#fff;padding:22px 26px;font-weight:800;font-size:1.1rem}
.bd{padding:24px 26px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eef1f4;font-size:.92rem}
.row span:first-child{color:#64748b}.badge{display:inline-block;padding:6px 14px;border-radius:20px;font-weight:800;font-size:.85rem}
.ok{background:#e6f6ef;color:#0a7d45}.bad{background:#fdecea;color:#c0392b}</style></head>
<body><div class="card"><div class="hd">🧾 Guideon — Invoice Verification</div><div class="bd">${body}</div></div></body></html>`;

  if (!bookingId) {
    return res.status(404).type('html').send(page(false, `<p><span class="badge bad">✗ Invalid or tampered</span></p>
      <p style="color:#64748b">This invoice code is not valid. It may have been altered.</p>`));
  }
  try {
    const booking = await bookings.findById(bookingId);
    if (!booking) {
      return res.status(404).type('html').send(page(false, `<p><span class="badge bad">✗ Not found</span></p>`));
    }
    const guide = booking.guideId ? await users.findById(booking.guideId) : null;
    const R = await commission.getRates();
    const br = invoice.breakdown(booking, commission.rateFor(guide, R), R.vat);
    res.type('html').send(page(true, `
      <p><span class="badge ok">✓ Genuine Guideon invoice</span></p>
      <div class="row"><span>Invoice No</span><strong>${invoice.invoiceNumber(booking)}</strong></div>
      <div class="row"><span>Issued to</span><strong>${(guide?.fullName || 'Guide').replace(/[<>]/g, '')}</strong></div>
      <div class="row"><span>Date</span><strong>${new Date(booking.paidAt || booking.createdAt).toLocaleDateString('en-GB')}</strong></div>
      <div class="row"><span>Net payout</span><strong>${br.net.toFixed(3)} OMR</strong></div>
      <div class="row"><span>Status</span><strong>${booking.isPaid ? 'Paid by customer' : 'Awaiting payment'}</strong></div>
      <p style="color:#64748b;font-size:.82rem;margin-top:16px">Issued by Vision for Digital Thought (Guideon) · guideon.om</p>`));
  } catch (e) {
    console.error('[accounting:verify]', e.message);
    res.status(500).type('html').send(page(false, `<p><span class="badge bad">Verification unavailable</span></p>`));
  }
};
