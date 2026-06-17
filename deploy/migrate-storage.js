/**
 * migrate-storage.js — download every object from the cloud Supabase Storage
 * bucket to a local folder, so it can be re-uploaded into the self-hosted
 * Supabase on the Oman server.
 *
 * Run from the repo root once the CLOUD Supabase project is RESTORED (un-paused):
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   SUPABASE_STORAGE_BUCKET=media \
 *   node deploy/migrate-storage.js ./storage-export
 *
 * Then upload ./storage-export/* into the self-hosted bucket (Studio or the
 * companion upload step in MIGRATION-GUIDE.md).
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'media';
const OUT = process.argv[2] || './storage-export';

if (!URL || !KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(URL, KEY);

async function walk(prefix = '') {
  let count = 0;
  const { data, error } = await sb.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) { console.error('list', prefix, error.message); return 0; }
  for (const entry of data || []) {
    const full = prefix ? `${prefix}/${entry.name}` : entry.name;
    const isFolder = entry.id === null || entry.metadata == null;   // folders have no id/metadata
    if (isFolder) { count += await walk(full); continue; }
    const { data: file, error: dErr } = await sb.storage.from(BUCKET).download(full);
    if (dErr) { console.error('download', full, dErr.message); continue; }
    const dest = path.join(OUT, full);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(await file.arrayBuffer()));
    count++;
    if (count % 25 === 0) console.log('…', count, 'files');
  }
  return count;
}

(async () => {
  console.log(`Exporting bucket "${BUCKET}" -> ${OUT}`);
  const n = await walk('');
  console.log(`Done. ${n} files exported.`);
})().catch(e => { console.error(e.message); process.exit(1); });
