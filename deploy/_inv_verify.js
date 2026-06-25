const invoice = require('./src/services/invoiceService');
const puppeteer = require('puppeteer');
const fs = require('fs');
(async () => {
  // 1) regenerate invoice PDF (note now removed)
  const items = [
    { desc: 'عمولة المنصّة — رحلات يونيو 2026', amount: 185.000 },
    { desc: 'رسوم خدمة وتسويق رقمي', amount: 25.500 },
  ];
  const pdf = await invoice.generateInvoice(
    { id: 'inv-sample01', items, createdAt: new Date().toISOString() },
    { name: 'دروب عُمان للسياحة', type: 'company', email: 'info@duroob.om' }, 0, ''
  );
  fs.writeFileSync('/tmp/sample-invoice.pdf', pdf);
  console.log('invoice size', pdf.length);

  // 2) screenshot the FROM party block (new tidy format) to verify visually
  const b = await puppeteer.launch({ headless:'new', executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args:['--no-sandbox','--disable-dev-shm-usage'] });
  const p = await b.newPage();
  await p.setViewport({ width: 480, height: 200, deviceScaleFactor: 2 });
  await p.setContent(`<div dir="rtl" style="font-family:'Noto Sans Arabic',Arial,sans-serif;background:#f5f8fb;border:1px solid #e6eef6;border-radius:12px;padding:16px 18px;width:440px;color:#173a6d">
    <div style="font-size:11px;color:#7a8aa0;font-weight:800;margin-bottom:8px">المُصدِر · FROM</div>
    <div style="font-size:16px;font-weight:800">الرؤية للفكر الرقمي</div>
    <div style="font-size:13px;color:#5a6b85;font-weight:600;direction:ltr;text-align:right">Vision for Digital Thought</div>
    <div style="font-size:12px;color:#5a6b85;margin-top:6px;line-height:1.7">السجل التجاري: <span style="direction:ltr;unicode-bidi:isolate"><b>1656928</b></span><br>السيب، مسقط، سلطنة عُمان<br><span style="direction:ltr;unicode-bidi:isolate">guideon.om · admin@guideon.om · +968 9525 5450</span></div>
  </div>`);
  await p.screenshot({ path: '/tmp/from-block.png' });
  await b.close();
  console.log('screenshot done');
})().catch(e=>console.log('ERR', e.message));
