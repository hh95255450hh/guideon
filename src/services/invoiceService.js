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
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
let QRCode; try { QRCode = require('qrcode'); } catch { QRCode = null; }

const GREEN = '#0f7b6c';
const DARK  = '#1a1a1a';
const GREY  = '#666666';
const LIGHT = '#e0e7e4';

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

function header(doc, rightTitle, rightLines) {
  doc.rect(0, 0, doc.page.width, 110).fill(GREEN);
  doc.fillColor('white').fontSize(26).font('Helvetica-Bold').text('Guideon', 50, 38);
  doc.fontSize(10).font('Helvetica').fillColor('#cfe7e1')
     .text('Vision for Digital Thought · D-U-N-S 850403864', 50, 72)
     .text('Seeb, Muscat, Sultanate of Oman · guideon.om', 50, 86);
  const right = doc.page.width - 50;
  doc.fontSize(13).font('Helvetica-Bold').fillColor('white').text(rightTitle, right - 200, 40, { width: 200, align: 'right' });
  doc.fontSize(9).font('Helvetica');
  rightLines.forEach((l, i) => doc.text(l, right - 200, 62 + i * 13, { width: 200, align: 'right' }));
}

function footer(doc, note) {
  const y = doc.page.height - 56;
  doc.fontSize(8).fillColor(GREY).font('Helvetica')
     .text(note || 'Guideon — operated by Vision for Digital Thought · guideon.om', 50, y, { width: doc.page.width - 100, align: 'center' })
     .text(`Generated ${new Date().toISOString()}`, 50, y + 12, { width: doc.page.width - 100, align: 'center' });
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
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const [yy, mm] = ym.split('-');
      const monthName = new Date(Date.UTC(+yy, +mm - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

      header(doc, 'PAYOUT STATEMENT', [`Period: ${monthName}`, `Guide: ${guide?.fullName || ''}`.slice(0, 32)]);

      // Totals
      const tot = bookings.reduce((acc, bk) => {
        const b = breakdown(bk, rate, vatRate);
        acc.gross += b.gross; acc.commission += b.commission; acc.vat += b.vat; acc.net += b.net;
        return acc;
      }, { gross: 0, commission: 0, vat: 0, net: 0 });

      let y = 135;
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(13).text(`${bookings.length} booking${bookings.length === 1 ? '' : 's'} this period`, 50, y);

      // Summary card
      y = 165;
      doc.roundedRect(50, y, doc.page.width - 100, 96, 8).fill('#f4f8f7');
      const scol = (label, value, x) => {
        doc.fillColor(GREY).font('Helvetica').fontSize(9).text(label, x, y + 18, { width: 120 });
        doc.fillColor(DARK).font('Helvetica-Bold').fontSize(14).text(r3(value).toFixed(3), x, y + 34, { width: 120 });
      };
      scol('Gross (OMR)', tot.gross, 70);
      scol('Platform fee', tot.commission, 200);
      if (vatRate > 0) scol('VAT', tot.vat, 330);
      doc.fillColor(GREEN).font('Helvetica').fontSize(9).text('NET PAYOUT (OMR)', doc.page.width - 200, y + 18, { width: 140 });
      doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(18).text(r3(tot.net).toFixed(3), doc.page.width - 200, y + 32, { width: 140 });

      // Table header
      y = 285;
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9);
      doc.text('DATE', 50, y).text('DESTINATION', 120, y).text('GROSS', 300, y, { width: 70, align: 'right' })
         .text('FEE', 380, y, { width: 70, align: 'right' }).text('NET', 470, y, { width: 75, align: 'right' });
      doc.moveTo(50, y + 14).lineTo(doc.page.width - 50, y + 14).strokeColor(LIGHT).stroke();

      // Rows
      y += 22;
      doc.font('Helvetica').fontSize(9).fillColor(GREY);
      const sorted = bookings.slice().sort((a, b) => new Date(a.paidAt || a.createdAt) - new Date(b.paidAt || b.createdAt));
      for (const bk of sorted) {
        if (y > doc.page.height - 90) { doc.addPage(); y = 60; }
        const b = breakdown(bk, rate, vatRate);
        doc.fillColor(GREY).text(new Date(bk.paidAt || bk.createdAt).toLocaleDateString('en-GB'), 50, y);
        doc.text(String(bk.destination || '—').slice(0, 26), 120, y);
        doc.text(b.gross.toFixed(3), 300, y, { width: 70, align: 'right' });
        doc.text(b.commission.toFixed(3), 380, y, { width: 70, align: 'right' });
        doc.fillColor(DARK).font('Helvetica-Bold').text(b.net.toFixed(3), 470, y, { width: 75, align: 'right' });
        doc.font('Helvetica').fillColor(GREY);
        y += 20;
      }

      footer(doc, `Payout statement · ${monthName} · Guideon`);
      doc.end();
    } catch (e) { reject(e); }
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
