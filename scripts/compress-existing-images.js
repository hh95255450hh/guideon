/**
 * Re-compress every existing image in Supabase Storage in-place.
 *
 * Walks the entire BUCKET (default: 'media'), downloads each image, runs it
 * through the same compression pipeline storageService uses on new uploads
 * (resize → WebP), and overwrites the file at its existing storage path.
 *
 * Because we keep the SAME filename (and Supabase serves files at predictable
 * URLs), every existing reference in the database (avatars, gallery photos,
 * tour covers, message attachments, etc.) keeps working with no DB updates.
 *
 * Designed to be safe:
 *  - Skip files that aren't images
 *  - Skip animated GIF/WebP
 *  - Skip tiny files (< 60 KB)
 *  - Skip if compressed size >= original (won't make things worse)
 *  - Detailed progress + final tally
 *  - --dry-run mode to just see what WOULD be compressed
 *
 * Usage:
 *   node scripts/compress-existing-images.js            # do the work
 *   node scripts/compress-existing-images.js --dry-run  # report only
 *
 * Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env (.env).
 */
require('dotenv').config();

const path = require('path');
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET       = process.env.SUPABASE_STORAGE_BUCKET || 'media';
const DRY_RUN      = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const PRESETS = {
  avatars:  { maxWidth: 512,  maxHeight: 512,  quality: 78, fit: 'cover'  },
  gallery:  { maxWidth: 1600, maxHeight: 1600, quality: 78, fit: 'inside' },
  homepage: { maxWidth: 1600, maxHeight: 1600, quality: 78, fit: 'inside' },
  messages: { maxWidth: 1280, maxHeight: 1280, quality: 75, fit: 'inside' },
  reviews:  { maxWidth: 1280, maxHeight: 1280, quality: 78, fit: 'inside' },
  GENERIC:  { maxWidth: 1600, maxHeight: 1600, quality: 78, fit: 'inside' },
};
function presetFor(folder) {
  const root = String(folder || '').split('/')[0].toLowerCase();
  return PRESETS[root] || PRESETS.GENERIC;
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tif', '.tiff', '.heic', '.heif', '.avif']);
const SKIP_EXTS  = new Set(['.gif', '.svg', '.mp4', '.webm', '.mov', '.m4v', '.ogg']); // animated / video / vector

// Walk a folder recursively. Supabase Storage list() is per-folder.
async function* walk(prefix = '') {
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await sb.storage.from(BUCKET).list(prefix, {
      limit, offset, sortBy: { column: 'name', order: 'asc' },
    });
    if (error) {
      console.error('list', prefix, '→', error.message);
      return;
    }
    if (!data || !data.length) return;
    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      // Items without a metadata blob are folders.
      if (item.id === null || item.metadata === null) {
        yield* walk(fullPath);
      } else {
        yield { path: fullPath, size: item.metadata?.size || 0, mime: item.metadata?.mimetype || '' };
      }
    }
    if (data.length < limit) return;
    offset += data.length;
  }
}

async function processOne(file) {
  const ext = path.extname(file.path).toLowerCase();
  if (SKIP_EXTS.has(ext)) return { status: 'skip-animated-or-video' };

  const looksLikeImage = IMAGE_EXTS.has(ext) || (file.mime || '').startsWith('image/');
  if (!looksLikeImage) return { status: 'skip-not-image' };

  if (file.size && file.size < 60 * 1024) return { status: 'skip-tiny' };

  // Download
  const { data: blob, error: dlErr } = await sb.storage.from(BUCKET).download(file.path);
  if (dlErr) return { status: 'error-download', message: dlErr.message };
  const buffer = Buffer.from(await blob.arrayBuffer());
  if (buffer.length < 60 * 1024) return { status: 'skip-tiny' };

  // Compress
  const preset = presetFor(path.dirname(file.path));
  let compressed;
  try {
    const img = sharp(buffer, { failOn: 'none' }).rotate();
    const meta = await img.metadata();
    if (meta.pages && meta.pages > 1) return { status: 'skip-animated' };
    compressed = await img
      .resize({
        width:  preset.maxWidth,
        height: preset.maxHeight,
        fit:    preset.fit,
        withoutEnlargement: true,
      })
      .webp({ quality: preset.quality, effort: 4 })
      .toBuffer();
  } catch (e) {
    return { status: 'error-compress', message: e.message };
  }

  if (compressed.length >= buffer.length) {
    return { status: 'skip-no-gain', original: buffer.length, compressed: compressed.length };
  }

  if (DRY_RUN) {
    return { status: 'would-compress', original: buffer.length, compressed: compressed.length };
  }

  // Overwrite in place at the same path. upsert: true to replace.
  const { error: upErr } = await sb.storage.from(BUCKET).upload(file.path, compressed, {
    contentType: 'image/webp',
    upsert: true,
    cacheControl: '31536000',
  });
  if (upErr) return { status: 'error-upload', message: upErr.message };

  return { status: 'compressed', original: buffer.length, compressed: compressed.length };
}

(async () => {
  console.log(`[compress] bucket=${BUCKET} dryRun=${DRY_RUN}`);
  const t0 = Date.now();
  const tally = {
    seen: 0, compressed: 0, wouldCompress: 0,
    skipTiny: 0, skipNotImage: 0, skipAnimated: 0, skipNoGain: 0,
    errors: 0,
    bytesBefore: 0, bytesAfter: 0,
  };

  for await (const file of walk('')) {
    tally.seen++;
    const res = await processOne(file);
    switch (res.status) {
      case 'compressed':
        tally.compressed++;
        tally.bytesBefore += res.original;
        tally.bytesAfter  += res.compressed;
        if (tally.compressed % 10 === 0) {
          console.log(`  ${tally.compressed} compressed · ${file.path} (${res.original}→${res.compressed})`);
        }
        break;
      case 'would-compress':
        tally.wouldCompress++;
        tally.bytesBefore += res.original;
        tally.bytesAfter  += res.compressed;
        break;
      case 'skip-tiny':           tally.skipTiny++; break;
      case 'skip-not-image':      tally.skipNotImage++; break;
      case 'skip-animated':
      case 'skip-animated-or-video': tally.skipAnimated++; break;
      case 'skip-no-gain':        tally.skipNoGain++; break;
      default:
        tally.errors++;
        console.warn(`  err ${file.path}: ${res.status} ${res.message || ''}`);
    }
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  const savedMB = (tally.bytesBefore - tally.bytesAfter) / 1024 / 1024;
  const pct = tally.bytesBefore ? Math.round((1 - tally.bytesAfter / tally.bytesBefore) * 100) : 0;

  console.log('\n──────── DONE ────────');
  console.log(`Time:           ${dt}s`);
  console.log(`Files seen:     ${tally.seen}`);
  console.log(`Compressed:     ${tally.compressed}${DRY_RUN ? ' (dry run: ' + tally.wouldCompress + ' would compress)' : ''}`);
  console.log(`Skip (tiny):    ${tally.skipTiny}`);
  console.log(`Skip (animated/video): ${tally.skipAnimated}`);
  console.log(`Skip (no gain): ${tally.skipNoGain}`);
  console.log(`Skip (not image):      ${tally.skipNotImage}`);
  console.log(`Errors:         ${tally.errors}`);
  console.log(`Bytes before:   ${(tally.bytesBefore / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Bytes after:    ${(tally.bytesAfter  / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Saved:          ${savedMB.toFixed(2)} MB (-${pct}%)`);
})();
