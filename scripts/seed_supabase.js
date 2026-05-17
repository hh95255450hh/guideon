/**
 * Seed Supabase with data from local JSON files.
 * Run: node scripts/seed_supabase.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uwgkszszsogivhphlfdy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_e7f2BmlvGIxIs3Ya1jyKrQ_hqW7X-jM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

function readJSON(filename) {
  const p = path.join(__dirname, '..', 'src', 'data', filename);
  try {
    const raw = fs.readFileSync(p, 'utf8').replace(/^﻿/, '');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function seed(tableName, data, pk = 'id') {
  if (!data.length) { console.log(`  ${tableName}: empty, skipping`); return; }

  for (const record of data) {
    const { error } = await supabase
      .from(tableName)
      .upsert(record, { onConflict: pk });

    if (error) {
      console.error(`  ✗ ${tableName} [${record[pk]}]:`, error.message);
    } else {
      console.log(`  ✓ ${tableName} [${record[pk]}]`);
    }
  }
}

async function main() {
  console.log('Seeding Supabase...\n');

  const users        = readJSON('users.json');
  const bookings     = readJSON('bookings.json');
  const reviewsData  = readJSON('reviews.json');
  const tripReqs     = readJSON('tripRequests.json');

  console.log('→ users:');
  await seed('users', users);

  console.log('\n→ bookings:');
  await seed('bookings', bookings);

  console.log('\n→ reviews:');
  await seed('reviews', reviewsData, 'reviewId');

  console.log('\n→ trip_requests:');
  await seed('trip_requests', tripReqs);

  console.log('\nDone!');
}

main().catch(console.error);
