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
  const docTitle = isTax ? 'TAX INVOICE' : 'EARNINGS INVOICE';

  // QR → verification page
  let qrBuf = null;
  if (QRCode) {
    try { qrBuf = await QRCode.toBuffer(`${APP_URL}/invoice/verify/${verifyToken(booking.id)}`, { margin: 1, width: 220 }); }
    catch { qrBuf = null; }
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const issued = new Date(booking.paidAt || booking.createdAt || Date.now());
      header(doc, docTitle, [
        `No: ${invNo}`,
        `Issued: ${issued.toLocaleDateString('en-GB')}`,
        isTax ? `VATIN: ${vatNumber}` : 'Self-billed',
      ]);

      // Self-billing note
      doc.fillColor(GREY).font('Helvetica').fontSize(9)
         .text('This invoice is issued by Guideon on behalf of the guide (self-billing) for services delivered through the platform.', 50, 122, { width: doc.page.width - 100 });

      // Parties
      let y = 150;
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11).text('Guide (payee)', 50, y);
      doc.font('Helvetica').fillColor(GREY).fontSize(10)
         .text(guide?.fullName || 'Unknown', 50, y + 16)
         .text(guide?.email || '', 50, y + 30)
         .text(guide?.phone || '', 50, y + 44);
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11).text('Platform', 320, y);
      doc.font('Helvetica').fillColor(GREY).fontSize(10)
         .text('Vision for Digital Thought', 320, y + 16)
         .text('North Al Mabilah, Seeb', 320, y + 30)
         .text('Muscat Governorate 112, Oman', 320, y + 44);

      // Service line
      y = 222;
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11).text('Service', 50, y);
      doc.font('Helvetica').fillColor(GREY).fontSize(10)
         .text(`Guided tour — ${booking.destination || '—'} · ${new Date(booking.tourDate).toLocaleDateString('en-GB')} · ${booking.participants || 1} pax`, 50, y + 16, { width: doc.page.width - 100 });
      doc.fontSize(9).text(`Booking ref: ${booking.id}`, 50, y + 32);

      // Breakdown table
      y = 280;
      doc.roundedRect(50, y, doc.page.width - 100, isTax ? 150 : 130, 8).strokeColor(LIGHT).stroke();
      const row = (label, value, yy, bold, color) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 11)
           .fillColor(color || (bold ? DARK : GREY)).text(label, 70, yy);
        doc.text(value, doc.page.width - 230, yy, { width: 160, align: 'right' });
      };
      let ry = y + 18;
      row('Gross booking value', omr(b.gross), ry); ry += 26;
      row(`Platform service fee (${(b.rate * 100).toFixed(0)}%)`, `- ${omr(b.commission)}`, ry); ry += 26;
      if (isTax) { row(`VAT on fee (${(vatRate * 100).toFixed(0)}%)`, `- ${omr(b.vat)}`, ry); ry += 26; }
      doc.moveTo(70, ry + 2).lineTo(doc.page.width - 70, ry + 2).strokeColor(LIGHT).stroke();
      row('Net payout to guide', omr(b.net), ry + 12, true, GREEN);

      // Status badge
      y += (isTax ? 170 : 150);
      const paid = !!booking.isPaid;
      doc.roundedRect(50, y, 160, 30, 6).fill(paid ? '#e6f6ef' : '#fff4e5');
      doc.fillColor(paid ? '#0a7d45' : '#a85b00').font('Helvetica-Bold').fontSize(11)
         .text(paid ? 'PAID BY CUSTOMER' : 'AWAITING PAYMENT', 60, y + 9);

      // QR verification
      if (qrBuf) {
        doc.image(qrBuf, doc.page.width - 130, y - 6, { width: 80 });
        doc.fillColor(GREY).font('Helvetica').fontSize(7)
           .text('Scan to verify', doc.page.width - 130, y + 76, { width: 80, align: 'center' });
      }

      footer(doc, isTax
        ? `Tax invoice · VATIN ${vatNumber} · Guideon`
        : 'Earnings invoice (no VAT charged) · Guideon');
      doc.end();
    } catch (e) { reject(e); }
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
async function generatePaymentVoucher(payment, payee) {
  const voucherNo = paymentVoucherNumber(payment.id, payment.createdAt);
  const issued = new Date(payment.createdAt || Date.now());
  const typeLabel = { guide: 'Guide / مرشد', company: 'Company / شركة', team: 'Team / فريق' }[payee.type] || 'Provider';
  let qrBuf = null;
  if (QRCode) { try { qrBuf = await QRCode.toBuffer(`${APP_URL}/  · ${voucherNo}`, { margin: 1, width: 200 }); } catch { qrBuf = null; } }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      header(doc, 'PAYMENT VOUCHER', [voucherNo, issued.toISOString().slice(0, 10), 'إشعار دفع']);

      let y = 140;
      doc.fillColor(DARK).fontSize(15).font('Helvetica-Bold').text('Payment Voucher — إشعار دفع', 50, y);
      y += 28;

      // Payee box
      doc.roundedRect(50, y, doc.page.width - 100, 78, 8).fill('#f4faf8');
      doc.fillColor(GREY).fontSize(9).font('Helvetica').text('PAID TO — صُرف إلى', 64, y + 12);
      doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold').text(payee.name || '—', 64, y + 28);
      doc.fillColor(GREY).fontSize(10).font('Helvetica')
         .text(`${typeLabel}${payee.email ? '  ·  ' + payee.email : ''}`, 64, y + 50);
      y += 100;

      // Amount — the headline
      doc.roundedRect(50, y, doc.page.width - 100, 70, 8).fill(GREEN);
      doc.fillColor('#cfe7e1').fontSize(10).font('Helvetica').text('AMOUNT PAID — المبلغ المدفوع', 64, y + 14);
      doc.fillColor('white').fontSize(26).font('Helvetica-Bold').text(omr(payment.amount), 64, y + 30);
      y += 92;

      // Details table
      const row = (k, v) => {
        doc.fillColor(GREY).fontSize(10).font('Helvetica').text(k, 64, y, { width: 180 });
        doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text(v, 244, y, { width: doc.page.width - 294 });
        y += 22;
      };
      row('Voucher No. — رقم الإشعار', voucherNo);
      row('Date — التاريخ', issued.toLocaleString('en-GB'));
      row('Description — البيان', payment.description || '—');
      row('Method — الطريقة', 'Treasury transfer — تحويل من الخزانة');
      row('Status — الحالة', 'PAID — مدفوع ✓');

      if (qrBuf) { try { doc.image(qrBuf, doc.page.width - 150, y + 6, { width: 90 }); } catch (_) {} }

      y += 30;
      doc.fillColor(GREY).fontSize(9).font('Helvetica')
         .text('This voucher confirms a payment issued by Guideon (Vision for Digital Thought) to the provider above.', 50, y, { width: doc.page.width - 160 })
         .text('هذا الإشعار يؤكّد صرف المبلغ أعلاه من Guideon إلى المزوّد المذكور.', 50, y + 14, { width: doc.page.width - 160 });

      footer(doc, 'Guideon — Payment Voucher · operated by Vision for Digital Thought · guideon.om');
      doc.end();
    } catch (e) { reject(e); }
  });
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
async function generateInvoice(invoice, recipient, vatRate = VAT_RATE, vatNumber = VAT_NUMBER) {
  const docNo  = invoice.number || invoiceDocNumber(invoice.id, invoice.createdAt);
  const issued = new Date(invoice.createdAt || Date.now());
  const isTax  = vatRate > 0 && !!vatNumber;
  const items  = Array.isArray(invoice.items) ? invoice.items : [];
  const subtotal = r3(items.reduce((s, it) => s + (Number(it.amount) || 0), 0));
  const vat   = r3(subtotal * (vatRate || 0));
  const total = r3(subtotal + vat);
  let qrBuf = null;
  if (QRCode) { try { qrBuf = await QRCode.toBuffer(`${APP_URL} · ${docNo}`, { margin: 1, width: 200 }); } catch { qrBuf = null; } }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      header(doc, isTax ? 'TAX INVOICE' : 'INVOICE', [docNo, issued.toISOString().slice(0, 10), isTax ? ('VATIN ' + vatNumber) : 'فاتورة']);

      let y = 140;
      doc.fillColor(GREY).fontSize(9).font('Helvetica').text('BILL TO — إلى', 50, y);
      doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold').text(recipient.name || '—', 50, y + 14);
      doc.fillColor(GREY).fontSize(10).font('Helvetica')
         .text(`${({ guide: 'Guide / مرشد', company: 'Company / شركة', team: 'Team / فريق' }[recipient.type] || '')}${recipient.email ? '  ·  ' + recipient.email : ''}`, 50, y + 34);
      y += 70;

      const W = doc.page.width, xAmt = W - 50;
      doc.rect(50, y, W - 100, 24).fill(GREEN);
      doc.fillColor('white').fontSize(10).font('Helvetica-Bold').text('Description — البيان', 60, y + 7);
      doc.text('Amount (OMR)', xAmt - 150, y + 7, { width: 140, align: 'right' });
      y += 24;
      items.forEach((it, i) => {
        if (i % 2) doc.rect(50, y, W - 100, 22).fill('#f6f9f8');
        doc.fillColor(DARK).fontSize(10).font('Helvetica').text(it.desc || '—', 60, y + 6, { width: W - 260 });
        doc.fillColor(DARK).text(r3(it.amount).toFixed(3), xAmt - 150, y + 6, { width: 140, align: 'right' });
        y += 22;
      });
      y += 14;

      const totRow = (k, v, bold) => {
        doc.fillColor(bold ? DARK : GREY).fontSize(bold ? 12 : 10).font(bold ? 'Helvetica-Bold' : 'Helvetica')
           .text(k, xAmt - 320, y, { width: 170, align: 'right' });
        doc.fillColor(bold ? GREEN : DARK).font('Helvetica-Bold').text(v, xAmt - 150, y, { width: 140, align: 'right' });
        y += bold ? 26 : 20;
      };
      totRow('Subtotal — المجموع', omr(subtotal));
      if (vatRate > 0) totRow(`VAT (${(vatRate * 100).toFixed(0)}%)`, omr(vat));
      totRow('TOTAL — الإجمالي', omr(total), true);

      if (invoice.note) {
        y += 8;
        doc.fillColor(GREY).fontSize(9).font('Helvetica').text('Note — ملاحظة: ' + invoice.note, 50, y, { width: W - 100 });
      }
      if (qrBuf) { try { doc.image(qrBuf, 50, doc.page.height - 150, { width: 80 }); } catch (_) {} }

      footer(doc, 'Guideon — Invoice · operated by Vision for Digital Thought · guideon.om');
      doc.end();
    } catch (e) { reject(e); }
  });
}

// Professional bilingual (AR/EN) renderer via HTML + Puppeteer — supersedes the
// pdfkit versions above (kept for reference but no longer exported), because
// pdfkit cannot shape Arabic text. The browser renders Arabic/RTL + the logo.
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
