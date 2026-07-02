// Run: node scripts/migrate.js
//
// Applies every numbered migration in database/migrations/ in order against the
// Postgres pointed to by DATABASE_URL. Migrations are expected to be idempotent
// (use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS etc.), so re-running is safe.
//
// This is a convenience for a fresh/self-hosted DB. In production the owner
// typically applies new numbered files manually in the Supabase SQL editor.
// ALL_MIGRATIONS.sql is intentionally skipped (it is a stale 001–005 snapshot).
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '../database/migrations');

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required. Set it in .env, or apply migrations manually in the Supabase SQL editor.');
    process.exit(1);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql') && f !== 'ALL_MIGRATIONS.sql')
    // numeric prefix order: 001, 002, … 054
    .sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

  if (!files.length) {
    console.log('No migration files found.');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    console.log(`Applying ${files.length} migration(s) from ${MIGRATIONS_DIR}\n`);
    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      process.stdout.write(`  → ${file} … `);
      try {
        await client.query(sql);
        console.log('ok');
      } catch (err) {
        console.log('FAILED');
        console.error(`\nMigration ${file} failed: ${err.message}`);
        console.error('Fix the migration (or apply it manually) and re-run. Migrations are idempotent, so already-applied ones are safe to re-run.');
        process.exit(1);
      }
    }
    console.log('\nAll migrations applied.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
