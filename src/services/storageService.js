const supabase = require('../config/supabase');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'media';

/**
 * Upload a file buffer to Supabase Storage.
 * Returns the public URL.
 */
async function uploadBuffer({ buffer, originalName, folder = 'misc', contentType }) {
  const ext = path.extname(originalName || '').toLowerCase() || '.bin';
  const filename = `${folder}/${uuidv4()}${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, {
      contentType: contentType || 'application/octet-stream',
      upsert: false,
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
