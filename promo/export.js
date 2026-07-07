// Render promo/guideon-promo.html to an MP4 by screen-recording it headlessly.
// Usage: node promo/export.js
const puppeteer = require('puppeteer');
const path = require('path');
const { execFileSync } = require('child_process');
const fs = require('fs');

const DURATION_MS = 26000;                 // 25s promo + 1s tail
const HTML  = path.resolve(__dirname, 'guideon-promo.html');
const WEBM  = path.resolve(__dirname, 'guideon-promo.webm');
const MP4   = path.resolve(__dirname, 'guideon-promo.mp4');
const url   = 'file://' + HTML.replace(/\\/g, '/');

(async () => {
  console.log('Launching browser…');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--no-sandbox', '--disable-setuid-sandbox',
      '--use-gl=angle', '--enable-gpu',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });

  console.log('Loading page + assets…');
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(async () => { if (document.fonts) await document.fonts.ready; });
  // let the big background video + flag image fully buffer
  await new Promise(r => setTimeout(r, 3000));

  // Reload so all CSS animations start from frame 0 with assets already cached.
  console.log('Restarting animation from t=0…');
  await page.reload({ waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(async () => {
    if (document.fonts) await document.fonts.ready;
    const v = document.getElementById('bgv');
    if (v) { try { v.currentTime = 0; await v.play(); } catch (e) {} }
  });
  await new Promise(r => setTimeout(r, 400));

  console.log('Recording 25s…');
  const recorder = await page.screencast({ path: WEBM });
  await new Promise(r => setTimeout(r, DURATION_MS));
  await recorder.stop();
  await browser.close();
  console.log('Raw capture:', WEBM);

  console.log('Transcoding to MP4 (H.264)…');
  execFileSync('ffmpeg', [
    '-y', '-i', WEBM,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-preset', 'slow', '-crf', '18',
    '-movflags', '+faststart',
    MP4,
  ], { stdio: 'inherit' });

  try { fs.unlinkSync(WEBM); } catch {}
  console.log('\n✅ DONE →', MP4);
})().catch(e => { console.error('EXPORT FAILED:', e); process.exit(1); });
