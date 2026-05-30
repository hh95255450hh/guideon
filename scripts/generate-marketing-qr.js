/**
 * Generate the QR code used in all marketing posters.
 * Produces:
 *   public/marketing/qr-guideon.svg  — scalable, lossless (used in posters)
 *   public/marketing/qr-guideon.png  — fallback / printable
 *
 * Run: node scripts/generate-marketing-qr.js
 */
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const TARGET_URL = 'https://guideon.om';
const OUT_DIR    = path.resolve(__dirname, '..', 'public', 'marketing');

const opts = {
  errorCorrectionLevel: 'H',     // ~30% redundancy — survives a logo overlay
  margin: 1,
  width: 480,
  color: {
    dark:  '#0f1c3e',            // brand navy
    light: '#ffffff',
  },
};

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // SVG (crisp at any zoom)
  const svg = await QRCode.toString(TARGET_URL, { ...opts, type: 'svg' });
  fs.writeFileSync(path.join(OUT_DIR, 'qr-guideon.svg'), svg);
  console.log('✓ Wrote qr-guideon.svg');

  // PNG (for non-SVG contexts)
  await QRCode.toFile(path.join(OUT_DIR, 'qr-guideon.png'), TARGET_URL, opts);
  console.log('✓ Wrote qr-guideon.png');

  console.log('\nQR target: ' + TARGET_URL);
})().catch(err => { console.error(err); process.exit(1); });
