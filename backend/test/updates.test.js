const test = require('node:test');
const assert = require('node:assert');

const { buildUpdate, diff } = require('../src/updates');

const HANDLERS = {
  first_name: (x) => String(x).trim(),
  status: (x) => String(x).toUpperCase(),
  notes: (x) => (x === null ? null : String(x)),
};

test('buildUpdate emits one assignment per supplied field', () => {
  const { assignments, params, changes } = buildUpdate(
    { first_name: ' Abebe ', status: 'active' },
    HANDLERS
  );
  assert.deepStrictEqual(assignments, ['first_name = $1', 'status = $2']);
  assert.deepStrictEqual(params, ['Abebe', 'ACTIVE']);
  assert.deepStrictEqual(changes, { first_name: 'Abebe', status: 'ACTIVE' });
});

test('buildUpdate honours startIndex so the id can be the last parameter', () => {
  const { assignments } = buildUpdate({ status: 'x' }, HANDLERS, { startIndex: 4 });
  assert.deepStrictEqual(assignments, ['status = $4']);
});

test('buildUpdate rejects an empty body', () => {
  assert.throws(() => buildUpdate({}, HANDLERS), /at least one field/);
  assert.throws(() => buildUpdate(undefined, HANDLERS), /at least one field/);
});

test('buildUpdate rejects unknown and immutable fields', () => {
  assert.throws(() => buildUpdate({ mrn: 'MRN-1' }, HANDLERS), /Unknown or immutable/);
});

test('buildUpdate rejects fields outside the role allowlist rather than ignoring them', () => {
  // Silently dropping the field would return 200 having changed nothing.
  assert.throws(
    () => buildUpdate({ status: 'active' }, HANDLERS, { allowed: ['first_name'] }),
    /role may not change/
  );
});

test('buildUpdate distinguishes an explicit null from an absent field', () => {
  const { changes } = buildUpdate({ notes: null }, HANDLERS);
  assert.deepStrictEqual(changes, { notes: null });
});

test('diff reports only the fields that actually changed', () => {
  const before = { first_name: 'Abebe', status: 'Active', notes: 'x' };
  const { oldValues, newValues, changed } = diff(before, { first_name: 'Kebede', status: 'Active' });
  assert.deepStrictEqual(changed, ['first_name']);
  assert.deepStrictEqual(oldValues, { first_name: 'Abebe' });
  assert.deepStrictEqual(newValues, { first_name: 'Kebede' });
});

test('diff treats a NUMERIC string and its number equal', () => {
  // The pg driver returns NUMERIC as a string, so 250.00 vs '250.00' is not a
  // change and must not be logged as one.
  const { changed } = diff({ total_amount: '250.00' }, { total_amount: 250.0 });
  assert.deepStrictEqual(changed, []);
});

test('diff compares dates by instant, not identity', () => {
  const a = new Date('2026-03-01T09:00:00Z');
  const b = new Date('2026-03-01T09:00:00Z');
  assert.deepStrictEqual(diff({ d: a }, { d: b }).changed, []);
  assert.deepStrictEqual(diff({ d: a }, { d: new Date('2026-03-02T09:00:00Z') }).changed, ['d']);
});

test('diff records a transition to and from null', () => {
  assert.deepStrictEqual(diff({ notes: 'x' }, { notes: null }).changed, ['notes']);
  assert.deepStrictEqual(diff({ notes: null }, { notes: 'x' }).changed, ['notes']);
});

test('diff ignores keys absent from the before row', () => {
  assert.deepStrictEqual(diff({ a: 1 }, { b: 2 }).changed, []);
});

test('diff still records a real change between numeric-looking values', () => {
  assert.deepStrictEqual(diff({ total_amount: '250.00' }, { total_amount: 250.5 }).changed,
    ['total_amount']);
});

test('diff does not treat booleans as numbers', () => {
  // Number(false) === 0, so a naive numeric comparison would call
  // false and 0 the same value.
  assert.deepStrictEqual(diff({ reminder_sent: false }, { reminder_sent: 0 }).changed,
    ['reminder_sent']);
  assert.deepStrictEqual(diff({ reminder_sent: false }, { reminder_sent: true }).changed,
    ['reminder_sent']);
});

test('diff compares a date column supplied as an ISO string', () => {
  assert.deepStrictEqual(
    diff({ due_date: new Date('2026-04-01T00:00:00Z') }, { due_date: '2026-04-01T00:00:00Z' })
      .changed,
    []
  );
});
