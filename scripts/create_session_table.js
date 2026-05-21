require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.query(`
  CREATE TABLE IF NOT EXISTS session (
    sid varchar NOT NULL COLLATE "default",
    sess json NOT NULL,
    expire timestamp(6) NOT NULL,
    PRIMARY KEY (sid)
  );
  CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
`)
  .then(() => { console.log('Session table ready.'); pool.end(); })
  .catch(e => { console.error('Error:', e.message); pool.end(); });
