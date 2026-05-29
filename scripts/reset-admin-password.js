#!/usr/bin/env node
/**
 * Reset the admin password to a known value.
 * Usage: node scripts/reset-admin-password.js [newPassword]
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const NEW_PASSWORD = process.argv[2] || 'Hh92Admin@2026';
const ADMIN_EMAIL  = 'hh92hh@guideon.om';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

(async () => {
  console.log(`🔑 Resetting password for ${ADMIN_EMAIL}...\n`);

  const hash = await bcrypt.hash(NEW_PASSWORD, 10);

  // Verify the hash works
  const test = await bcrypt.compare(NEW_PASSWORD, hash);
  console.log(`  Hash test: ${test ? '✓ valid' : '✗ FAILED'}`);

  const { data, error } = await sb
    .from('users')
    .update({
      password: hash,
      isSuspended: false,
      updatedAt: new Date().toISOString(),
    })
    .ilike('email', ADMIN_EMAIL)
    .select('id, email, userType, isSuspended');

  if (error) { console.log('❌ Error:', error.message); return; }
  if (!data || !data.length) { console.log('❌ No admin found with that email'); return; }

  console.log('\n✅ Password updated successfully:\n');
  console.log('  Email:    ' + ADMIN_EMAIL);
  console.log('  Password: ' + NEW_PASSWORD);
  console.log('  User ID:  ' + data[0].id);
  console.log('  Type:     ' + data[0].userType);
  console.log('  Active:   ' + !data[0].isSuspended);
  console.log('\nLogin at: https://www.guideon.om/login.html');
})();
