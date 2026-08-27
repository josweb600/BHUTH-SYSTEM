const pg = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set - database queries will fail.');
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // Retire a connection after this many checkouts. Unset means never, which is
  // what you want against a real server; the integration harness sets it to 1
  // because its in-process Postgres bridge does not survive a query error.
  ...(process.env.PG_POOL_MAX_USES && { maxUses: Number(process.env.PG_POOL_MAX_USES) }),
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = { pool };
