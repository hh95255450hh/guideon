// Run: node scripts/migrate.js
// Sets up the full database schema on a fresh PostgreSQL instance (Railway, Render, etc.)
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Pool({
        host: process.env.DB_HOST, port: process.env.DB_PORT,
        database: process.env.DB_NAME, user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      });

  const client = await pool.connect();
  try {
    console.log('Running schema migration...');
    const schema = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
    await client.query(schema);

    console.log('Running migrations...');
    const migration = fs.readFileSync(
      path.join(__dirname, '../database/migrations/001_add_fcm_token.sql'), 'utf8'
    );
    await client.query(migration);

    console.log('Migration complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
