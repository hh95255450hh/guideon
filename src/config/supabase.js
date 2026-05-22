const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

let supabase;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[Supabase] ⚠️ Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars. DB operations will fail until set.');
  // Stub client so the app boots and health checks pass; DB calls return errors.
  const stubError = { message: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY env vars.' };
  const handler = {
    get(target, prop) {
      if (prop === 'from')    return () => new Proxy({}, handler);
      if (prop === 'storage') return new Proxy({}, handler);
      if (prop === 'auth')    return new Proxy({}, handler);
      if (typeof prop === 'string') {
        if (['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'ilike', 'or', 'order', 'limit', 'maybeSingle', 'single'].includes(prop)) {
          return (...args) => prop === 'select' || prop === 'eq' || prop === 'ilike' || prop === 'order' || prop === 'limit'
            ? new Proxy({}, handler)
            : Promise.resolve({ data: null, error: stubError });
        }
        if (['upload', 'remove', 'getPublicUrl', 'createSignedUrl'].includes(prop)) {
          return prop === 'getPublicUrl'
            ? () => ({ data: { publicUrl: '' } })
            : () => Promise.resolve({ data: null, error: stubError });
        }
      }
      return () => new Proxy({}, handler);
    },
  };
  supabase = new Proxy({}, handler);
} else {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });
}

module.exports = supabase;
