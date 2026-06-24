/**
 * pdfDocs — professional bilingual (Arabic + English) PDF documents rendered
 * via Puppeteer (the browser handles Arabic shaping, RTL and fonts perfectly,
 * which pdfkit cannot). Used for admin invoices and treasury payment vouchers.
 */
const path = require('path');
const fs = require('fs');
let puppeteer; try { puppeteer = require('puppeteer'); } catch { puppeteer = null; }

const r3  = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const omr = (n) => r3(n).toFixed(3);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ── Company / platform identity ─────────────────────────────────────────────
const COMPANY = {
  ar: 'الرؤية للفكر الرقمي',
  en: 'Vision for Digital Thought',
  cr: '1656928',          // السجل التجاري
  duns: '850403864',
  platform: 'Guideon',
  site: 'guideon.om',
  email: 'admin@guideon.om',
  phone: '+968 9525 5450',
  addrAr: 'السيب، مسقط، سلطنة عُمان',
  addrEn: 'Seeb, Muscat, Sultanate of Oman',
};

// Embed the logo so the PDF is self-contained (no network fetch).
let LOGO = '';
try {
  const buf = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'logo.png'));
  LOGO = 'data:image/png;base64,' + buf.toString('base64');
} catch { LOGO = ''; }

// ── Puppeteer render ────────────────────────────────────────────────────────
async function htmlToPdf(html) {
  if (!puppeteer) throw new Error('PDF engine unavailable');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const bytes = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
    // Newer Puppeteer returns a Uint8Array; res.send() would JSON-serialize
    // that into a corrupt, bloated "file". Always hand back a real Buffer.
    return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  } finally { await browser.close(); }
}

const TYPE_AR = { guide: 'مرشد', company: 'شركة', team: 'فريق' };
const TYPE_EN = { guide: 'Guide', company: 'Company', team: 'Team' };

function shell(title, bodyHtml) {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:"Noto Sans Arabic","Noto Sans",Arial,sans-serif; color:#1a2233; -webkit-print-color-adjust:exact; }
  .page { padding:0 0 90px; min-height:100vh; position:relative; }
  .band { background:linear-gradient(120deg,#0f1c3e 0%,#173a6d 55%,#0f7b6c 100%); color:#fff; padding:28px 40px; display:flex; justify-content:space-between; align-items:flex-start; }
  .brand { display:flex; align-items:center; gap:14px; }
  .brand img { height:54px; width:auto; background:#fff; border-radius:10px; padding:6px; }
  .brand .nm { font-size:26px; font-weight:800; letter-spacing:.5px; }
  .brand .tag { font-size:11px; color:#cfe7e1; margin-top:2px; }
  .docbox { text-align:left; }
  .docbox .t { font-size:22px; font-weight:800; letter-spacing:1px; }
  .docbox .meta { font-size:12px; color:#dfe8f5; margin-top:8px; line-height:1.7; }
  .docbox .meta b { color:#fff; }
  .body { padding:28px 40px; }
  .parties { display:flex; gap:18px; margin-bottom:22px; }
  .party { flex:1; background:#f5f8fb; border:1px solid #e6eef6; border-radius:12px; padding:16px 18px; }
  .party .h { font-size:11px; color:#7a8aa0; font-weight:800; letter-spacing:.5px; margin-bottom:8px; }
  .party .n { font-size:16px; font-weight:800; }
  .party .n2 { font-size:13px; color:#5a6b85; font-weight:600; direction:ltr; text-align:right; }
  .party .l { font-size:12px; color:#5a6b85; margin-top:6px; line-height:1.7; }
  table { width:100%; border-collapse:collapse; margin-top:6px; }
  thead th { background:#0f7b6c; color:#fff; font-size:12px; font-weight:700; padding:11px 14px; text-align:right; }
  thead th.amt { text-align:left; }
  tbody td { padding:11px 14px; font-size:13px; border-bottom:1px solid #eef2f7; }
  tbody td.amt { text-align:left; direction:ltr; font-weight:700; }
  tbody tr:nth-child(even) td { background:#f8fafc; }
  .totals { margin-top:18px; margin-inline-start:auto; width:320px; }
  .totals .r { display:flex; justify-content:space-between; padding:8px 4px; font-size:13px; color:#46566f; }
  .totals .r.grand { margin-top:6px; padding:13px 14px; background:#0f7b6c; color:#fff; border-radius:10px; font-size:17px; font-weight:800; }
  .totals .r .v { direction:ltr; font-weight:800; }
  .note { margin-top:22px; background:#fff8ec; border:1px solid #f3e2bf; border-radius:10px; padding:12px 16px; font-size:12px; color:#7a6526; }
  .stamp { margin-top:26px; display:inline-block; border:2px solid #0f7b6c; color:#0f7b6c; font-weight:800; padding:8px 22px; border-radius:8px; transform:rotate(-4deg); font-size:14px; }
  .foot { position:absolute; bottom:0; left:0; right:0; background:#0f1c3e; color:#cdd7e8; font-size:11px; padding:14px 40px; display:flex; justify-content:space-between; }
  .foot .x { direction:ltr; }
</style></head><body><div class="page">${bodyHtml}</div></body></html>`;
}

function partiesBlock(recipient) {
  return `
  <div class="parties">
    <div class="party">
      <div class="h">المُصدِر · FROM</div>
      <div class="n">${esc(COMPANY.ar)}</div>
      <div class="n2">${esc(COMPANY.en)}</div>
      <div class="l">السجل التجاري: <span style="direction:ltr;unicode-bidi:isolate"><b>${COMPANY.cr}</b></span><br>${esc(COMPANY.addrAr)}<br><span style="direction:ltr;unicode-bidi:isolate">${COMPANY.site} · ${COMPANY.email} · ${COMPANY.phone}</span></div>
    </div>
    <div class="party">
      <div class="h">المستفيد · BILL TO</div>
      <div class="n">${esc(recipient.name || '—')}</div>
      <div class="l">${TYPE_AR[recipient.type] || ''} · ${TYPE_EN[recipient.type] || 'Provider'}${recipient.email ? `<br><span style="direction:ltr;unicode-bidi:isolate">${esc(recipient.email)}</span>` : ''}</div>
    </div>
  </div>`;
}

function footer() {
  return `<div class="foot"><span>${esc(COMPANY.platform)} — ${esc(COMPANY.ar)}</span><span class="x">${COMPANY.site} · ${esc(COMPANY.en)}</span></div>`;
}

// ── Invoice ─────────────────────────────────────────────────────────────────
async function renderInvoice(invoice, recipient, vatRate = 0, vatNumber = '') {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const subtotal = r3(items.reduce((s, it) => s + (Number(it.amount) || 0), 0));
  const vat = r3(subtotal * (vatRate || 0));
  const total = r3(subtotal + vat);
  const isTax = vatRate > 0 && !!vatNumber;
  const issued = new Date(invoice.createdAt || Date.now());

  const rows = items.map(it => `<tr><td>${esc(it.desc) || '—'}</td><td class="amt">${omr(it.amount)}</td></tr>`).join('');
  const body = `
    <div class="band">
      <div class="brand">${LOGO ? `<img src="${LOGO}">` : ''}<div><div class="nm">${COMPANY.platform}</div><div class="tag">${esc(COMPANY.ar)} · ${esc(COMPANY.en)}</div></div></div>
      <div class="docbox"><div class="t">${isTax ? 'فاتورة ضريبيّة · TAX INVOICE' : 'فاتورة · INVOICE'}</div>
        <div class="meta">رقم · No: <b>${esc(invoice.number)}</b><br>التاريخ · Date: <b>${issued.toLocaleDateString('en-GB')}</b>${isTax ? `<br>الرقم الضريبي · VATIN: ${esc(vatNumber)}` : ''}</div>
      </div>
    </div>
    <div class="body">
      ${partiesBlock(recipient)}
      <table>
        <thead><tr><th>البيان · Description</th><th class="amt">المبلغ (ر.ع) · Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <div class="r"><span>المجموع · Subtotal</span><span class="v">${omr(subtotal)}</span></div>
        ${vatRate > 0 ? `<div class="r"><span>ض.ق.م · VAT (${(vatRate * 100).toFixed(0)}%)</span><span class="v">${omr(vat)}</span></div>` : ''}
        <div class="r grand"><span>الإجمالي · TOTAL</span><span class="v">${omr(total)} ر.ع</span></div>
      </div>
    </div>
    ${footer()}`;
  return htmlToPdf(shell('Invoice', body));
}

// ── Payment voucher ─────────────────────────────────────────────────────────
async function renderVoucher(payment, payee) {
  const issued = new Date(payment.createdAt || Date.now());
  const body = `
    <div class="band">
      <div class="brand">${LOGO ? `<img src="${LOGO}">` : ''}<div><div class="nm">${COMPANY.platform}</div><div class="tag">${esc(COMPANY.ar)} · ${esc(COMPANY.en)}</div></div></div>
      <div class="docbox"><div class="t">إشعار دفع · PAYMENT VOUCHER</div>
        <div class="meta">رقم · No: <b>${esc(payment.number || payment.id)}</b><br>التاريخ · Date: <b>${issued.toLocaleDateString('en-GB')}</b></div>
      </div>
    </div>
    <div class="body">
      ${partiesBlock(payee)}
      <div class="totals" style="width:100%; margin:0">
        <div class="r grand" style="font-size:20px"><span>المبلغ المدفوع · AMOUNT PAID</span><span class="v">${omr(payment.amount)} ر.ع</span></div>
      </div>
      <table style="margin-top:20px">
        <tbody>
          <tr><td style="width:200px;color:#7a8aa0">البيان · Description</td><td>${esc(payment.description) || '—'}</td></tr>
          <tr><td style="color:#7a8aa0">الطريقة · Method</td><td>تحويل من الخزانة · Treasury transfer</td></tr>
          <tr><td style="color:#7a8aa0">الحالة · Status</td><td><b style="color:#0f7b6c">مدفوع · PAID ✓</b></td></tr>
        </tbody>
      </table>
      <div class="stamp">مدفوع · PAID</div>
    </div>
    ${footer()}`;
  return htmlToPdf(shell('Voucher', body));
}

module.exports = { renderInvoice, renderVoucher, htmlToPdf, COMPANY };
