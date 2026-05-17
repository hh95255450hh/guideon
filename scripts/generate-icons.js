/**
 * Generates icon-192.png and icon-512.png for the Guideon PWA.
 * Uses only Node.js built-ins (zlib) — no external packages needed.
 *
 * Design: teal background · white circle ring · teal inner · gold crescent
 */
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── CRC32 (needed for PNG chunks) ─────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = (CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(d.length, 0);
  const crc = Buffer.allocUnsafe(4); crc.writeUInt32BE(crc32(Buffer.concat([t, d])), 0);
  return Buffer.concat([len, t, d, crc]);
}

// ── Drawing helpers ───────────────────────────────────────────────────────────
function fillAll(px, size, r, g, b) {
  for (let i = 0; i < size * size; i++) {
    px[i * 3] = r; px[i * 3 + 1] = g; px[i * 3 + 2] = b;
  }
}

function fillCircle(px, size, cx, cy, radius, r, g, b) {
  const r2 = radius * radius;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        const i = (y * size + x) * 3;
        px[i] = r; px[i + 1] = g; px[i + 2] = b;
      }
    }
  }
}

function fillEllipse(px, size, cx, cy, rx, ry, r, g, b) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        const i = (y * size + x) * 3;
        px[i] = r; px[i + 1] = g; px[i + 2] = b;
      }
    }
  }
}

function fillRect(px, size, x0, y0, w, h, r, g, b) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x >= 0 && x < size && y >= 0 && y < size) {
        const i = (y * size + x) * 3;
        px[i] = r; px[i + 1] = g; px[i + 2] = b;
      }
    }
  }
}

// ── Icon design ───────────────────────────────────────────────────────────────
function drawIcon(size) {
  const px  = new Uint8Array(size * size * 3);
  const s   = size;
  const cx  = s / 2, cy = s / 2;

  // Colors
  const TEAL  = [15, 123, 108];
  const WHITE = [255, 255, 255];
  const GOLD  = [201, 168, 76];
  const DARK  = [10,  85,  75];

  // 1. Teal background
  fillAll(px, s, ...TEAL);

  // 2. Large white circle (outer ring)
  fillCircle(px, s, cx, cy, s * 0.46, ...WHITE);

  // 3. Teal inner circle (ring effect)
  fillCircle(px, s, cx, cy, s * 0.38, ...TEAL);

  // 4. Draw a stylised palm leaf (vertical ellipse pointing up)
  const leafW = s * 0.07, leafH = s * 0.26;
  fillEllipse(px, s, cx, cy - s * 0.07, leafW, leafH, ...WHITE);

  // 5. Two side leaves
  fillEllipse(px, s, cx - s * 0.14, cy - s * 0.10, leafW * 0.85, leafH * 0.75, ...WHITE);
  fillEllipse(px, s, cx + s * 0.14, cy - s * 0.10, leafW * 0.85, leafH * 0.75, ...WHITE);

  // 6. Trunk (thin rect below leaves)
  const trunkW = Math.max(2, Math.round(s * 0.045));
  const trunkH = Math.round(s * 0.18);
  fillRect(px, s,
    Math.round(cx - trunkW / 2),
    Math.round(cy + s * 0.02),
    trunkW, trunkH, ...GOLD);

  // 7. Gold dots (stars) — top left & right of ring
  const dotR = Math.max(2, Math.round(s * 0.03));
  fillCircle(px, s, Math.round(cx - s * 0.28), Math.round(cy - s * 0.28), dotR, ...GOLD);
  fillCircle(px, s, Math.round(cx + s * 0.28), Math.round(cy - s * 0.28), dotR, ...GOLD);

  return px;
}

// ── Encode pixels → PNG buffer ────────────────────────────────────────────────
function encodePNG(size, pixels) {
  // Build raw scanlines (filter byte 0 = None, then RGB)
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 3);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 3;
      row[1 + x * 3]     = pixels[s];
      row[1 + x * 3 + 1] = pixels[s + 1];
      row[1 + x * 3 + 2] = pixels[s + 2];
    }
    rows.push(row);
  }
  const raw        = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const OUT = path.join(__dirname, '..', 'public');

[192, 512].forEach(size => {
  const pixels = drawIcon(size);
  const png    = encodePNG(size, pixels);
  const file   = path.join(OUT, `icon-${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`✅  icon-${size}.png  (${png.length} bytes)`);
});

console.log('Icons ready in public/');
