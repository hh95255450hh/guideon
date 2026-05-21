require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await client.connect();
  // Disable RLS — Express server handles auth/session security
  await client.query(`ALTER TABLE messages DISABLE ROW LEVEL SECURITY;`);
  console.log('RLS disabled on messages table');
  await client.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
