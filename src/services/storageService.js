const supabase = require('../config/supabase');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let sharp = null;
try { sharp = require('sharp'); } catch (_) { /* sharp unavailable — fall back to raw upload */ }

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'media';

// Image presets — each folder gets a sensible size+quality ceiling so we
// stop serving 6 MB iPhone originals from Supabase storage (and burning
// Egress quota). Anything not listed falls back to GENERIC.
const PRESETS = {
  // Tighter ceilings to cut Supabase egress. Cards and hero images on
  // modern phones rarely render past ~1200 px — anything larger just
  // wastes bandwidth on every page view.
  avatars:  { maxWidth: 400,  maxHeight: 400,  quality: 75, fit: 'cover'   }, // profile photo (renders ≤110 px)
  gallery:  { maxWidth: 1200, maxHeight: 1200, quality: 72, fit: 'inside'  }, // guide / company gallery
  homepage: { maxWidth: 1400, maxHeight: 1400, quality: 72, fit: 'inside'  }, // hero / tour cover / asset photos
  messages: { maxWidth: 1000, maxHeight: 1000, quality: 70, fit: 'inside'  }, // chat attachments
  reviews:  { maxWidth: 1000, maxHeight: 1000, quality: 72, fit: 'inside'  },
  GENERIC:  { maxWidth: 1200, maxHeight: 1200, quality: 72, fit: 'inside'  },
};

function presetFor(folder) {
  if (!folder) return PRESETS.GENERIC;
  const root = String(folder).split('/')[0].toLowerCase();
  return PRESETS[root] || PRESETS.GENERIC;
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tif', '.tiff', '.heic', '.heif', '.avif']);
const PASS_THROUGH_EXTS = new Set(['.gif', '.svg']); // animations / vectors — don't re-encode

function isImage(originalName, contentType) {
  const ext = path.extname(originalName || '').toLowerCase();
  if (IMAGE_EXTS.has(ext)) return true;
  if ((contentType || '').startsWith('image/')) return true;
  return false;
}

/**
 * Compress an image buffer to WebP using preset bounds. Returns the new
 * buffer + the extension to use on the upload (so the URL/filename matches
 * the actual encoding). On any failure (sharp missing, unsupported format,
 * tiny file, animated GIF, etc.) returns the original.
 */
async function compressImage(buffer, folder, originalName) {
  if (!sharp) return null;
  const ext = path.extname(originalName || '').toLowerCase();
  if (PASS_THROUGH_EXTS.has(ext)) return null;
  // Tiny files (< 60 KB) usually aren't worth re-encoding; keep them.
  if (buffer.length < 60 * 1024) return null;

  const preset = presetFor(folder);
  try {
    const img = sharp(buffer, { failOn: 'none' }).rotate(); // honor EXIF orientation
    const meta = await img.metadata();
    // Skip animated GIF/WebP — sharp would drop the animation.
    if (meta.pages && meta.pages > 1) return null;

    const out = await img
      .resize({
        width:  preset.maxWidth,
        height: preset.maxHeight,
        fit:    preset.fit,
        withoutEnlargement: true,
      })
      .webp({ quality: preset.quality, effort: 4 })
      .toBuffer();

    // If sharp couldn't beat the original (rare on already-tiny files), keep
    // the original to avoid making things worse.
    if (out.length >= buffer.length) return null;

    return { buffer: out, extension: '.webp', contentType: 'image/webp' };
  } catch (e) {
    console.warn('[storage] compress failed (' + (originalName || 'unknown') + '):', e.message);
    return null;
  }
}

/**
 * Upload a file buffer to Supabase Storage. Images are auto-compressed
 * (resized + transcoded to WebP) on the way in, so the bytes Supabase
 * stores and serves are dramatically smaller — typically 90%+ less Egress
 * per page view.
 *
 * Returns the public URL.
 */
async function uploadBuffer({ buffer, originalName, folder = 'misc', contentType }) {
  let finalBuffer  = buffer;
  let finalExt     = path.extname(originalName || '').toLowerCase() || '.bin';
  let finalType    = contentType || 'application/octet-stream';

  if (isImage(originalName, contentType)) {
    const compressed = await compressImage(buffer, folder, originalName);
    if (compressed) {
      finalBuffer = compressed.buffer;
      finalExt    = compressed.extension;
      finalType   = compressed.contentType;
      const saved = buffer.length - compressed.buffer.length;
      const pct   = Math.round((saved / buffer.length) * 100);
      console.log(`[storage] compressed ${folder}/${originalName || '?'} ${buffer.length} → ${compressed.buffer.length} bytes (-${pct}%)`);
    }
  }

  const filename = `${folder}/${uuidv4()}${finalExt}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, finalBuffer, {
      contentType: finalType,
      upsert: false,
      cacheControl: '31536000', // 1 year — images are content-addressed via uuid
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return { url: data.publicUrl, path: filename };
}

/**
 * Delete a file from Supabase Storage by its full URL or path.
 */
async function deleteByUrl(urlOrPath) {
  if (!urlOrPath) return;
  let storagePath = urlOrPath;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  if (urlOrPath.includes(marker)) {
    storagePath = urlOrPath.split(marker)[1];
  }
  if (!storagePath) return;
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) console.error('[storage] delete:', error.message);
}

module.exports = { uploadBuffer, deleteByUrl, BUCKET };
