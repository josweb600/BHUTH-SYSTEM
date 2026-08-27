/**
 * End-to-end test harness.
 *
 * Runs a real PostgreSQL 18 (PGlite, compiled to WebAssembly) in-process, loads
 * database/schema.sql into it unmodified, and exposes it over the Postgres wire
 * protocol on a local port so the API's own `pg` pool connects to it without any
 * code changes. Nothing is stubbed: the CHECK constraints, NOT NULL columns,
 * foreign keys and uuid_generate_v4() defaults are the real ones.
 */

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

const { PGlite } = require('@electric-sql/pglite');
const { uuid_ossp } = require('@electric-sql/pglite/contrib/uuid_ossp');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');

const SCHEMA_PATH = path.join(__dirname, '..', '..', '..', 'database', 'schema.sql');

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Start Postgres, load the schema, return { databaseUrl, stop }. */
async function startDatabase() {
  const db = await PGlite.create({ extensions: { uuid_ossp, pgcrypto } });

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  await db.exec(schema);

  const port = await freePort();
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });
  await server.start();

  return {
    db,
    port,
    databaseUrl: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`,
    async stop() {
      await server.stop();
      await db.close();
    },
  };
}

/** Start the API as a child process pointed at the test database. */
async function startApi({ databaseUrl, env = {} }) {
  const { spawn } = require('node:child_process');
  const port = await freePort();

  const child = spawn(
    process.execPath,
    [path.join(__dirname, '..', '..', 'src', 'server.js')],
    {
      env: {
        ...process.env,
        PORT: String(port),
        DATABASE_URL: databaseUrl,
        JWT_SECRET: 'integration-test-secret-that-is-definitely-long-enough',
        // The PGlite socket bridge serves one connection at a time, so the pool
        // must not open a second. This is a limitation of the test harness, not
        // of the application - production reads PG_POOL_MAX from the environment.
        PG_POOL_MAX: '1',
        CORS_ORIGIN: 'http://localhost:3000',
        NODE_ENV: 'test',
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  const logs = [];
  child.stdout.on('data', (d) => logs.push(d.toString()));
  child.stderr.on('data', (d) => logs.push(d.toString()));

  const base = `http://127.0.0.1:${port}`;

  // Wait for /api/health to report a live database.
  const deadline = Date.now() + 20000;
  for (;;) {
    if (Date.now() > deadline) {
      child.kill('SIGKILL');
      throw new Error(`API did not become healthy.\n${logs.join('')}`);
    }
    try {
      const res = await fetch(`${base}/api/health`);
      const body = await res.json();
      if (res.ok && /connect/i.test(JSON.stringify(body))) break;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  return {
    base,
    logs,
    async stop() {
      child.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 300));
      child.kill('SIGKILL');
    },
  };
}

/** Small fetch wrapper returning { status, body }. */
async function call(base, method, url, { token, body, headers = {} } = {}) {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let parsed = null;
  const text = await res.text();
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

/**
 * Consume the connection the bridge closed.
 *
 * PGlite's socket bridge terminates the client socket whenever a query raises an
 * error, so the next pooled query fails with "Connection terminated
 * unexpectedly" before the pool recovers on its own. A real PostgreSQL server
 * keeps the connection, so this is a harness quirk. Call it after any request
 * that deliberately violates a constraint, so the discarded connection is spent
 * here rather than inside the following test.
 */
async function warm(base) {
  for (let i = 0; i < 2; i += 1) {
    try {
      await fetch(`${base}/api/health`);
    } catch {
      // ignore
    }
  }
}

module.exports = { startDatabase, startApi, call, warm };
