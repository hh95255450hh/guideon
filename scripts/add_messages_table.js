require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await client.connect();
  console.log('Connected to Supabase Postgres');

  await client.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "fromId"    TEXT NOT NULL,
      "toId"      TEXT NOT NULL,
      "fromName"  TEXT NOT NULL DEFAULT '',
      "toName"    TEXT NOT NULL DEFAULT '',
      content     TEXT NOT NULL,
      "isRead"    BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('messages table created (or already exists)');

  await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_fromId ON messages ("fromId");`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_toId   ON messages ("toId");`);
  console.log('Indexes created');

  await client.end();
  console.log('Done.');
}

run().catch(e => { console.error(e); process.exit(1); });
