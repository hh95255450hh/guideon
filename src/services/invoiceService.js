/**
 * Guide accounting & invoicing.
 *
 * The platform earns a commission per paid booking; the rest is the guide's
 * payout. This service turns that into proper accounting documents:
 *
 *   - generateGuideInvoice(booking, guide)  → a self-billed "Earnings Invoice"
 *     PDF for one booking (gross → platform fee → VAT → net payout), with a
 *     deterministic invoice number and a QR code that links to a public
 *     verification page (anti-fraud, e-invoicing-style).
 *   - generateStatement(guide, bookings, ym) → a monthly payout statement PDF
 *     summarising every booking in the month with totals.
 *
 * Money model (all OMR, 3-decimal):
 *   gross      = booking.totalAmount (what the tourist paid)
 *   commission = gross × COMMISSION_RATE         (platform service fee)
 *   vat        = commission × VAT_RATE           (VAT on the platform's fee)
 *   net        = gross − commission − vat         (guide payout)
 *
 * VAT is OFF by default (VAT_RATE=0). Set VAT_RATE=0.05 + VAT_NUMBER once the
 * platform is VAT-registered, and the documents become full tax invoices.
 */
const crypto = require('crypto');
let QRCode; try { QRCode = require('qrcode'); } catch { QRCode = null; }

const APP_URL = (process.env.APP_URL || 'https://guideon.om').replace(/\/$/, '');
const COMMISSION_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.10');
const VAT_RATE        = parseFloat(process.env.VAT_RATE || '0');         // 0.05 when registered
const VAT_NUMBER      = process.env.VAT_NUMBER || '';
const SIGN_SECRET     = process.env.INVOICE_SECRET || process.env.SESSION_SECRET || 'guideon-dev-invoice';

const r3  = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const omr = (n) => `${r3(n).toFixed(3)} OMR`;

// ── Money breakdown for one booking ──
// `rate` is the commission fraction for this booking's provider; defaults to
// the env constant so legacy callers keep working. Pass the resolved rate
// (commission.rateFor) to honour per-type / per-user rates.
function breakdown(booking, rate = COMMISSION_RATE, vatRate = VAT_RATE) {
  const gross      = r3(booking.totalAmount);
  const commission = r3(gross * (rate != null ? rate : COMMISSION_RATE));
  const vat        = r3(commission * vatRate);
  const net        = r3(gross - commission - vat);
  return { gross, commission, vat, net, rate: rate != null ? rate : COMMISSION_RATE };
}

// Stable, unique invoice number per booking (no DB needed).
function invoiceNumber(booking) {
  const yr = new Date(booking.paidAt || booking.createdAt || Date.now()).getUTCFullYear();
  const short = String(booking.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
  return `GDN-INV-${yr}-${short}`;
}

// ── Verification token (signed, stateless) ──
// Encodes the booking id + an HMAC so the public verify page can confirm the
// invoice is genuine without exposing anything guessable.
function verifyToken(bookingId) {
  const body = Buffer.from(String(bookingId)).toString('base64url');
  const sig  = crypto.createHmac('sha256', SIGN_SECRET).update(body).digest('base64url').slice(0, 16);
  return `${body}.${sig}`;
}
function decodeToken(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', SIGN_SECRET).update(body).digest('base64url').slice(0, 16);
  // timing-safe compare
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return Buffer.from(body, 'base64url').toString('utf8'); } catch { return null; }
}

// ════════════════════ Per-booking earnings invoice ════════════════════
async function generateGuideInvoice(booking, guide, tourist, rate, vatRate = VAT_RATE, vatNumber = VAT_NUMBER) {
  const b = breakdown(booking, rate, vatRate);
  const invNo = invoiceNumber(booking);
  const isTax = vatRate > 0 && !!vatNumber;
  const issued = new Date(booking.paidAt || booking.createdAt || Date.now());

  // QR → verification page (data URL for the HTML renderer).
  let qr = null;
  if (QRCode) {
    try { qr = await QRCode.toDataURL(`${APP_URL}/invoice/verify/${verifyToken(booking.id)}`, { margin: 1, width: 220 }); }
    catch { qr = null; }
  }

  const tourDate = booking.tourDate ? new Date(booking.tourDate).toLocaleDateString('en-GB') : '—';
  const dest = String(booking.destination || '—').replace(/\s+/g, ' ').trim();
  const serviceLine = `رحلة إرشاديّة · Guided tour — ${dest} · ${tourDate} · ${booking.participants || 1} pax`;

  // Render through the Puppeteer engine (pdfDocs) so Arabic shapes correctly,
  // the logo is embedded, and the QR verification code is included.
  return require('./pdfDocs').renderEarningsInvoice({
    invNo,
    docTitle: isTax ? 'فاتورة ضريبيّة · TAX INVOICE' : 'فاتورة أرباح · EARNINGS INVOICE',
    issued: issued.toLocaleDateString('en-GB'),
    isTax, vatNumber,
    guide: {
      name:  guide?.fullName || guide?.companyName || 'Unknown',
      email: guide?.email || '',
      phone: guide?.phone || '',
    },
    service: { line: serviceLine, bookingRef: booking.id },
    gross: b.gross, commission: b.commission, ratePct: (b.rate * 100).toFixed(0),
    vat: b.vat, net: b.net,
    paid: !!booking.isPaid,
    qr,
  });
}

// ════════════════════ Monthly payout statement ════════════════════
function generateStatement(guide, bookings, ym /* YYYY-MM */, rate, vatRate = VAT_RATE) {
  const [yy, mm] = String(ym).split('-');
  const monthName = new Date(Date.UTC(+yy, +mm - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const tot = { gross: 0, commission: 0, vat: 0, net: 0 };
  const sorted = bookings.slice().sort((a, b) => new Date(a.paidAt || a.createdAt) - new Date(b.paidAt || b.createdAt));
  const rows = sorted.map(bk => {
    const b = breakdown(bk, rate, vatRate);
    tot.gross += b.gross; tot.commission += b.commission; tot.vat += b.vat; tot.net += b.net;
    return {
      date: new Date(bk.paidAt || bk.createdAt).toLocaleDateString('en-GB'),
      destination: String(bk.destination || '—').replace(/\s+/g, ' ').trim(),
      gross: b.gross, commission: b.commission, net: b.net,
    };
  });

  // Rendered via the Puppeteer engine so Arabic destinations shape correctly.
  return require('./pdfDocs').renderStatement({
    monthName,
    guideName: guide?.fullName || guide?.companyName || '',
    count: bookings.length,
    totals: { gross: r3(tot.gross), commission: r3(tot.commission), vat: r3(tot.vat), net: r3(tot.net) },
    vatRate,
    rows,
  });
}

// ════════════════════ Payment voucher (treasury → provider) ════════════════
// A professional "Payment Voucher / إشعار دفع" PDF issued automatically when the
// company sends money to a guide / company / team from the treasury.
//   payment = { id, amount, description, createdAt, ref }
//   payee   = { name, type, email }
function paymentVoucherNumber(id, when) {
  const yr = new Date(when || Date.now()).getUTCFullYear();
  const short = String(id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
  return `GDN-PV-${yr}-${short}`;
}
// ════════════════════ Custom invoice (admin → provider) ════════════════════
// A proper multi-line invoice the admin issues to a guide / company / team.
//   invoice   = { id, number?, items:[{desc,amount}], note, createdAt }
//   recipient = { name, type, email }
function invoiceDocNumber(id, when) {
  const yr = new Date(when || Date.now()).getUTCFullYear();
  const short = String(id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
  return `GDN-BILL-${yr}-${short}`;
}
// Bilingual (AR/EN) PDF renderers via HTML + Puppeteer. pdfkit cannot shape
// Arabic, so the admin invoice and payment voucher are rendered by the browser
// (Arabic/RTL + embedded logo). The monthly statement above still uses pdfkit
// (English/numeric only).
function _invoiceHtml(invoice, recipient, vatRate = VAT_RATE, vatNumber = VAT_NUMBER) {
  const number = invoice.number || invoiceDocNumber(invoice.id, invoice.createdAt);
  return require('./pdfDocs').renderInvoice({ ...invoice, number }, recipient, vatRate, vatNumber);
}
function _voucherHtml(payment, payee) {
  const number = payment.number || paymentVoucherNumber(payment.id, payment.createdAt);
  return require('./pdfDocs').renderVoucher({ ...payment, number }, payee);
}

module.exports = {
  breakdown, invoiceNumber, verifyToken, decodeToken,
  generateGuideInvoice, generateStatement, paymentVoucherNumber, invoiceDocNumber,
  generateInvoice: _invoiceHtml, generatePaymentVoucher: _voucherHtml,
  COMMISSION_RATE, VAT_RATE,
};
