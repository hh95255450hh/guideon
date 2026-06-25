(async () => {
  try {
    const puppeteer = require('puppeteer');
    const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] });
    const p = await b.newPage();
    await p.setContent('<h1 style="font-family:sans-serif">مرحبا Test العربية</h1>');
    const pdf = await p.pdf({ format: 'A4' });
    await b.close();
    console.log('PUPPETEER OK — pdf bytes:', pdf.length);
  } catch (e) { console.log('PUPPETEER FAIL:', e.message.split('\n')[0]); }
})();
