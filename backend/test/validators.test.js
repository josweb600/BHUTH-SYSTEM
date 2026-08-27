const test = require('node:test');
const assert = require('node:assert');

const v = require('../src/validators');

test('status values are canonicalised to the capitalisation the CHECK constraint requires', () => {
  assert.strictEqual(v.canonicalise('pending', v.BILL_STATUSES, 'status'), 'Pending');
  assert.strictEqual(v.canonicalise('PAID', v.BILL_STATUSES, 'status'), 'Paid');
  assert.strictEqual(v.canonicalise('scheduled', v.APPOINTMENT_STATUSES, 'status'), 'Scheduled');
  assert.strictEqual(v.canonicalise('no_show', v.APPOINTMENT_STATUSES, 'status'), 'No_Show');
  assert.strictEqual(v.canonicalise('in_progress', v.LAB_STATUSES, 'status'), 'In_Progress');
});

test('an unknown status is rejected with the allowed values, not passed to Postgres', () => {
  assert.throws(
    () => v.canonicalise('archived', v.BILL_STATUSES, 'status'),
    (err) => err instanceof v.ValidationError
      && err.status === 400
      && err.details.allowed.includes('Paid')
  );
});

test('an absent status is undefined rather than an error, so filters stay optional', () => {
  assert.strictEqual(v.canonicalise(undefined, v.BILL_STATUSES, 'status'), undefined);
  assert.strictEqual(v.canonicalise('', v.BILL_STATUSES, 'status'), undefined);
});

test('gender and blood type match their constraints', () => {
  assert.strictEqual(v.canonicalise('f', v.GENDERS, 'gender'), 'F');
  assert.strictEqual(v.canonicalise('ab+', v.BLOOD_TYPES, 'blood_type'), 'AB+');
  assert.throws(() => v.canonicalise('male', v.GENDERS, 'gender'), v.ValidationError);
  assert.throws(() => v.canonicalise('C+', v.BLOOD_TYPES, 'blood_type'), v.ValidationError);
});

test('malformed UUIDs are rejected before reaching the database', () => {
  assert.ok(v.isUuid('3f6d1c0e-4a2b-4c7d-9e1f-0a1b2c3d4e5f'));
  assert.ok(!v.isUuid('1'));
  assert.ok(!v.isUuid('abc'));
  assert.ok(!v.isUuid(''));
  assert.ok(!v.isUuid(null));
  assert.throws(() => v.requireUuid('1', 'patient_id'), v.ValidationError);
});

test('pagination clamps limit so a client cannot request the whole table', () => {
  assert.deepStrictEqual(v.pagination({ page: '1', limit: '10' }), { page: 1, limit: 10, offset: 0 });
  assert.deepStrictEqual(v.pagination({ page: '3', limit: '25' }), { page: 3, limit: 25, offset: 50 });
  assert.strictEqual(v.pagination({ limit: '100000' }).limit, 100);
  assert.strictEqual(v.pagination({ limit: '0' }).limit, 10);
  assert.strictEqual(v.pagination({ limit: '-5' }).limit, 10);
  assert.strictEqual(v.pagination({ limit: 'abc' }).limit, 10);
  assert.strictEqual(v.pagination({ page: '-2' }).page, 1);
  assert.strictEqual(v.pagination({ page: '0' }).page, 1);
  assert.strictEqual(v.pagination({ page: 'abc' }).page, 1);
  assert.deepStrictEqual(v.pagination({}), { page: 1, limit: 10, offset: 0 });
});

test('date fields require YYYY-MM-DD, matching the DATE columns', () => {
  assert.strictEqual(v.requireDate('2026-08-27', 'bill_date'), '2026-08-27');
  assert.throws(() => v.requireDate('27/08/2026', 'bill_date'), v.ValidationError);
  assert.throws(() => v.requireDate('', 'bill_date'), v.ValidationError);
  assert.strictEqual(v.optionalDate(undefined, 'due_date'), null);
  assert.strictEqual(v.optionalDate('', 'due_date'), null);
});

test('appointment_date accepts a full timestamp, since the column carries the time', () => {
  const iso = v.requireTimestamp('2026-09-01T09:30:00Z', 'appointment_date');
  assert.strictEqual(iso, '2026-09-01T09:30:00.000Z');
  assert.throws(() => v.requireTimestamp('not a date', 'appointment_date'), v.ValidationError);
  assert.throws(() => v.requireTimestamp(undefined, 'appointment_date'), v.ValidationError);
});

test('money rounds to two decimals and refuses negatives', () => {
  assert.strictEqual(v.money('1200.456', 'total_amount'), 1200.46);
  assert.strictEqual(v.money(0, 'discount_amount'), 0);
  assert.strictEqual(v.money(undefined, 'discount_amount'), 0);
  assert.throws(() => v.money(-1, 'total_amount'), v.ValidationError);
  assert.throws(() => v.money('abc', 'total_amount'), v.ValidationError);
  assert.throws(() => v.money(undefined, 'total_amount', { required: true }), v.ValidationError);
});

test('money rejects values that would overflow NUMERIC(10,2)', () => {
  assert.throws(() => v.money(100000000, 'total_amount'), v.ValidationError);
  assert.strictEqual(v.money(99999998.5, 'total_amount'), 99999998.5);
});

test('patient_responsibility is derived from the other amounts', () => {
  assert.strictEqual(v.patientResponsibility({ total: 1000, discount: 100, insurance: 700 }), 200);
  assert.strictEqual(v.patientResponsibility({ total: 500, discount: 0, insurance: 500 }), 0);
});

test('discount plus insurance cannot exceed the total', () => {
  assert.throws(
    () => v.patientResponsibility({ total: 100, discount: 60, insurance: 60 }),
    v.ValidationError
  );
});

test('required strings are trimmed and length-checked against the column width', () => {
  assert.strictEqual(v.requireString('  MRN-001  ', 'mrn', 20), 'MRN-001');
  assert.throws(() => v.requireString('   ', 'mrn', 20), v.ValidationError);
  assert.throws(() => v.requireString(undefined, 'mrn', 20), v.ValidationError);
  assert.throws(() => v.requireString('x'.repeat(21), 'mrn', 20), v.ValidationError);
  assert.strictEqual(v.optionalString(undefined, 'city', 50), null);
  assert.throws(() => v.optionalString('x'.repeat(51), 'city', 50), v.ValidationError);
});
