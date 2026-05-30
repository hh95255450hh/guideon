/**
 * Diagnose the "forgot password email never arrives" report.
 *
 *  1. Lists every admin/staff account and its exact stored email.
 *  2. Optionally sends a real password-reset email to a given address to
 *     prove the pipeline works end-to-end.
 *
 * Usage:
 *   node scripts/test-password-reset.js                 # just list accounts
 *   node scripts/test-password-reset.js you@email.com   # also send a test reset
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const emailService = require('../src/services/emailService');
const crypto = require('crypto');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

(async () => {
  console.log('\n=== Admin / staff accounts ===');
  const { data: admins, error } = await supabase
    .from('users')
    .select('id, email, fullName, userType, staffRole, isSuspended')
    .or('userType.eq.admin,staffRole.not.is.null');

  if (error) { console.error('DB error:', error.message); process.exit(1); }
  if (!admins || !admins.length) {
    console.log('  (none found)');
  } else {
    admins.forEach(u => {
      console.log(`  • email="${u.email}"  name="${u.fullName || '—'}"  type=${u.userType}  role=${u.staffRole || '—'}  suspended=${!!u.isSuspended}`);
    });
  }

  const target = process.argv[2];
  if (!target) {
    console.log('\nTip: pass an email to send a real test reset, e.g.');
    console.log('     node scripts/test-password-reset.js Hh95255450hh@hotmail.com\n');
    process.exit(0);
  }

  console.log(`\n=== Sending test password-reset email to ${target} ===`);
  // Find the matching user (case-insensitive) so the name renders correctly.
  const { data: match } = await supabase
    .from('users').select('id, email, fullName').ilike('email', target).maybeSingle();

  if (!match) {
    console.warn(`  ⚠️  No account with email "${target}" — this is exactly why no`);
    console.warn('      reset email arrives: the address you type must match the');
    console.warn('      account email shown above.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  try {
    await emailService.sendPasswordReset({
      email: target,
      name: match?.fullName || 'there',
      token,
    });
    console.log('  ✅ Email dispatched. Check inbox + Spam/Junk.');
    console.log(`     Reset link in the email: ${process.env.APP_URL || 'https://guideon.om'}/reset-password.html?token=${token.slice(0,12)}...`);
  } catch (e) {
    console.error('  ❌ Send failed:', e.message);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
