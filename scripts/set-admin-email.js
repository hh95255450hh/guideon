/**
 * Change an admin account's email to a real, reachable inbox so that
 * password-reset / notification emails actually arrive.
 *
 * Usage:
 *   node scripts/set-admin-email.js <oldEmail> <newEmail>
 *   node scripts/set-admin-email.js hh92hh@guideon.guide Hh95255450hh@hotmail.com
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const oldEmail = process.argv[2];
const newEmail = process.argv[3];

if (!oldEmail || !newEmail) {
  console.error('Usage: node scripts/set-admin-email.js <oldEmail> <newEmail>');
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
  console.error('New email is not a valid address.');
  process.exit(1);
}

(async () => {
  const { data: user, error } = await supabase
    .from('users').select('id, email, userType, fullName').ilike('email', oldEmail).maybeSingle();

  if (error) { console.error('DB error:', error.message); process.exit(1); }
  if (!user) { console.error(`No account found with email "${oldEmail}".`); process.exit(1); }

  // Make sure the new email isn't already taken by someone else.
  const { data: clash } = await supabase
    .from('users').select('id').ilike('email', newEmail).neq('id', user.id).maybeSingle();
  if (clash) { console.error(`"${newEmail}" is already used by another account.`); process.exit(1); }

  const { error: upErr } = await supabase
    .from('users')
    .update({ email: newEmail.toLowerCase(), emailVerified: true })
    .eq('id', user.id);

  if (upErr) { console.error('Update failed:', upErr.message); process.exit(1); }

  console.log('✅ Admin email updated.');
  console.log(`   Account:   ${user.fullName} (${user.userType})`);
  console.log(`   Old email: ${user.email}`);
  console.log(`   New email: ${newEmail.toLowerCase()}`);
  console.log('\n   You can now use this email for "Forgot password".');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
