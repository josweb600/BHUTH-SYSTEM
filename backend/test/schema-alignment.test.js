/**
 * Regression guard for issue #3.
 *
 * The API previously queried column names and status literals that
 * database/schema.sql does not define, so every data endpoint failed at runtime.
 * These tests read the real schema file and the real route files and assert they
 * still agree, so the same drift cannot reappear silently.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = fs.readFileSync(
  path.join(__dirname, '..', '..', 'database', 'schema.sql'),
  'utf8'
);

const ROUTES_DIR = path.join(__dirname, '..', 'src', 'routes');
const ROUTE_SQL = fs
  .readdirSync(ROUTES_DIR)
  .filter((f) => f.endsWith('.js'))
  .map((f) => fs.readFileSync(path.join(ROUTES_DIR, f), 'utf8'))
  .join('\n');

/** Column names declared for a table in schema.sql. */
function columnsOf(table) {
  const match = SCHEMA.match(new RegExp(`CREATE TABLE ${table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i'));
  assert.ok(match, `${table} not found in schema.sql`);
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT|INDEX)\b/i.test(line))
    .map((line) => line.split(/\s+/)[0])
    .filter((name) => /^[a-z_]+$/.test(name));
}

test('schema.sql still defines the four tables the API writes to', () => {
  for (const table of ['patients', 'appointments', 'lab_tests', 'bills']) {
    assert.ok(columnsOf(table).length > 0, `${table} has no columns`);
  }
});

test('the columns issue #3 reported as missing are still absent from the schema', () => {
  // If any of these ever become real columns, the corresponding route should be
  // revisited rather than this test simply relaxed.
  assert.ok(!columnsOf('patients').includes('contact_number'));
  assert.ok(!columnsOf('patients').includes('insurance_id'));
  assert.ok(!columnsOf('appointments').includes('appointment_time'));
  assert.ok(!columnsOf('appointments').includes('reason'));
  assert.ok(!columnsOf('lab_tests').includes('test_name'));
  assert.ok(!columnsOf('bills').includes('description'));
});

test('routes use the real column names, not the ones from issue #3', () => {
  for (const wrong of [
    'contact_number',
    'insurance_id',
    'appointment_time',
    'test_name',
  ]) {
    assert.ok(
      !new RegExp(`\\b${wrong}\\b`).test(ROUTE_SQL),
      `route SQL still references ${wrong}`
    );
  }
});

test('routes reference the real primary keys', () => {
  assert.ok(columnsOf('patients').includes('patient_id'));
  assert.ok(/\bpatient_id\b/.test(ROUTE_SQL));
  assert.ok(columnsOf('lab_tests').includes('test_type'));
  assert.ok(/\btest_type\b/.test(ROUTE_SQL));
  assert.ok(columnsOf('patients').includes('phone'));
  assert.ok(/\bphone\b/.test(ROUTE_SQL));
});

test('every NOT NULL column without a default is supplied by the insert', () => {
  // These are the columns that made every POST fail. Each must appear in the
  // corresponding INSERT column list, or be filled by a NOW()/derived value.
  const required = {
    patients: ['mrn', 'first_name', 'last_name', 'date_of_birth', 'gender', 'phone'],
    appointments: ['patient_id', 'doctor_id', 'appointment_date'],
    lab_tests: ['patient_id', 'ordered_by', 'test_type', 'request_date'],
    bills: ['bill_number', 'patient_id', 'bill_date', 'total_amount', 'patient_responsibility', 'created_by'],
  };

  for (const [table, columns] of Object.entries(required)) {
    const insert = ROUTE_SQL.match(
      new RegExp(`INSERT INTO ${table}\\s*\\n?\\s*\\(([\\s\\S]*?)\\)\\s*\\n?\\s*VALUES`, 'i')
    );
    assert.ok(insert, `no INSERT INTO ${table} found`);
    const supplied = insert[1].split(',').map((c) => c.trim());
    for (const column of columns) {
      assert.ok(
        supplied.includes(column),
        `INSERT INTO ${table} omits NOT NULL column ${column}`
      );
    }
  }
});

test('status literals in route SQL match the CHECK constraints', () => {
  // Collect every quoted status-like literal the routes use in SQL.
  const constraints = [...SCHEMA.matchAll(/status VARCHAR\(\d+\)[^,]*CHECK \(status IN \(([^)]*)\)\)/gi)]
    .flatMap((m) => m[1].split(',').map((s) => s.trim().replace(/'/g, '')));

  assert.ok(constraints.includes('Pending'), 'expected capitalised statuses in schema');

  const lowercase = constraints
    .map((s) => s.toLowerCase())
    .filter((s) => s !== s.toUpperCase());

  for (const bad of lowercase) {
    assert.ok(
      !new RegExp(`status\\s*(=|IN\\s*\\()\\s*'${bad}'`, 'i').test(ROUTE_SQL)
        || !new RegExp(`'${bad}'`).test(ROUTE_SQL),
      `route SQL compares status against lowercase '${bad}'`
    );
  }
});

test('the dashboard query uses capitalised statuses', () => {
  const analytics = fs.readFileSync(path.join(ROUTES_DIR, 'analytics.js'), 'utf8');
  assert.ok(/status = 'Active'/.test(analytics));
  assert.ok(/status = 'Scheduled'/.test(analytics));
  assert.ok(/'Paid'/.test(analytics));
  assert.ok(!/'active'/.test(analytics));
  assert.ok(!/'scheduled'/.test(analytics));
  assert.ok(!/'paid'/.test(analytics));
  assert.ok(!/'pending'/.test(analytics));
});

test('schema.sql has no MySQL-style inline INDEX declarations', () => {
  // PostgreSQL rejects `INDEX name (col)` inside CREATE TABLE, which made the
  // whole file unloadable. Fixed in #2; asserted here so it cannot come back.
  const inline = SCHEMA.match(/^\s+INDEX\s+\w+\s*\(/gm);
  assert.strictEqual(inline, null, `inline INDEX declarations found: ${inline}`);
});
