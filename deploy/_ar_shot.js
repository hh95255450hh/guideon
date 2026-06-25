const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless:'new', executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] });
  const p = await b.newPage();
  await p.setViewport({ width: 820, height: 360, deviceScaleFactor: 2 });
  await p.setContent(`<div dir="rtl" style="font-family:'Noto Sans Arabic','Noto Naskh Arabic','KacstOne',Arial,sans-serif;font-size:30px;padding:36px;line-height:1.9;background:#fff;color:#173a6d">
    <b>فاتورة — الرؤية للفكر الرقمي</b><br>
    Vision for Digital Thought · منصّة Guideon<br>
    عمولة المنصّة — رحلات يونيو 2026<br>
    المبلغ المستحقّ: <b>185.000 ر.ع</b> · السجل التجاري 1656928
  </div>`);
  await p.screenshot({ path: '/tmp/arabic-test.png' });
  await b.close();
  console.log('screenshot saved');
})().catch(e=>console.log('ERR', e.message));
