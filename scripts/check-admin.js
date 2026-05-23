#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

(async () => {
  console.log('🔎 Searching for admin accounts...\n');

  // 1. All admins
  const { data: admins, error: e1 } = await sb
    .from('users')
    .select('*')
    .eq('userType', 'admin');

  if (e1) { console.log('Error:', e1.message); return; }

  console.log(`Admins found: ${admins.length}`);
  admins.forEach(u => {
    console.log(`  • email=${u.email}  fullName=${u.fullName || '—'}  suspended=${!!u.isSuspended}  id=${u.id}  hashLen=${(u.password||'').length}`);
  });

  // 2. Any user with hh92 in email
  const { data: hhUsers } = await sb
    .from('users')
    .select('id, email, userType, isSuspended')
    .ilike('email', '%hh92%');

  console.log(`\nUsers matching "hh92": ${hhUsers?.length || 0}`);
  hhUsers?.forEach(u => console.log(`  • ${u.email}  type=${u.userType}  suspended=${!!u.isSuspended}`));

  // 3. Staff
  const { data: staff } = await sb
    .from('users')
    .select('id, email, userType, staffRole, permissions')
    .not('staffRole', 'is', null);

  console.log(`\nStaff accounts: ${staff?.length || 0}`);
  staff?.forEach(u => console.log(`  • ${u.email}  role=${u.staffRole}  perms=${(u.permissions || []).length}`));
})();
