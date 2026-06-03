/**
 * Persistent express-session store backed by Supabase (via the anon key).
 * No Postgres connection string / DB password needed — uses the same
 * supabase-js client the rest of the app uses. Sessions survive restarts
 * and deploys, so users stay logged in.
 *
 * Requires the `app_sessions` table (migration 025).
 */
const { createClient } = require('@supabase/supabase-js');

module.exports = function (session) {
  const Store = session.Store;
  // Use the service-role key (bypasses RLS) when available so sessions keep
  // working after RLS is enabled; fall back to anon for local/dev.
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
  const TABLE = 'app_sessions';
  const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  const ttl = (sess) =>
    (sess && sess.cookie && sess.cookie.maxAge) ? sess.cookie.maxAge : DEFAULT_TTL;

  class SupabaseStore extends Store {
    get(sid, cb) {
      sb.from(TABLE).select('sess,expire').eq('sid', sid).maybeSingle()
        .then(({ data, error }) => {
          if (error) { console.warn('[session:get]', error.message); return cb(null, null); }
          if (!data) return cb(null, null);
          if (data.expire && new Date(data.expire) < new Date()) {
            sb.from(TABLE).delete().eq('sid', sid).then(() => {});
            return cb(null, null);
          }
          const sess = typeof data.sess === 'string' ? JSON.parse(data.sess) : data.sess;
          cb(null, sess);
        })
        .catch(e => { console.warn('[session:get]', e.message); cb(null, null); });
    }

    set(sid, sess, cb) {
      const expire = new Date(Date.now() + ttl(sess)).toISOString();
      sb.from(TABLE).upsert({ sid, sess, expire }, { onConflict: 'sid' })
        .then(({ error }) => cb && cb(error || null))
        .catch(e => cb && cb(e));
    }

    destroy(sid, cb) {
      sb.from(TABLE).delete().eq('sid', sid)
        .then(() => cb && cb(null))
        .catch(e => cb && cb(e));
    }

    touch(sid, sess, cb) {
      const expire = new Date(Date.now() + ttl(sess)).toISOString();
      sb.from(TABLE).update({ expire }).eq('sid', sid)
        .then(() => cb && cb(null))
        .catch(() => cb && cb(null));
    }
  }

  return SupabaseStore;
};
