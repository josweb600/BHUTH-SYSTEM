/**
 * End-to-end tests against a real PostgreSQL instance with the real schema.
 *
 * These are the tests that would have caught issue #3: every request below goes
 * through Express, the auth middleware, the routers and the actual CHECK
 * constraints, NOT NULL columns and foreign keys in database/schema.sql.
 */

const test = require('node:test');
const assert = require('node:assert');

const { hashPassword } = require('../../src/auth/passwords');
const { startDatabase, startApi, call, warm } = require('./harness');

const PASSWORD = 'integration-test-password';

let db;
let api;
const users = {};
let patientId;

test.before(async () => {
  db = await startDatabase();

  const hash = await hashPassword(PASSWORD);
  const seed = [
    ['EMP001', 'Ada', 'Admin', 'admin@bhuth.test', 'Admin'],
    ['EMP002', 'Paul', 'Physician', 'doctor@bhuth.test', 'Physician'],
    ['EMP003', 'Rita', 'Reception', 'reception@bhuth.test', 'Receptionist'],
    ['EMP004', 'Abe', 'Accountant', 'accountant@bhuth.test', 'Accountant'],
    ['EMP005', 'Lena', 'Lab', 'lab@bhuth.test', 'Lab_Technician'],
  ];
  for (const [employeeId, first, last, email, role] of seed) {
    const res = await db.db.query(
      `INSERT INTO users (employee_id, first_name, last_name, email, password_hash, role)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING user_id`,
      [employeeId, first, last, email, hash, role]
    );
    users[role] = { email, userId: res.rows[0].user_id };
  }

  api = await startApi({ databaseUrl: db.databaseUrl });

  for (const role of Object.keys(users)) {
    const res = await call(api.base, 'POST', '/api/auth/login', {
      body: { email: users[role].email, password: PASSWORD },
    });
    assert.strictEqual(res.status, 200, `login failed for ${role}: ${JSON.stringify(res.body)}`);
    users[role].token = res.body.access_token;
    users[role].refresh = res.body.refresh_token;
  }
});

test.after(async () => {
  if (process.env.DUMP_LOGS && api) {
    console.error('----- API LOG -----');
    console.error(api.logs.join('').split('\n').filter((l) => /rror|at /.test(l)).slice(0, 30).join('\n'));
  }
  if (api) await api.stop();
  if (db) await db.stop();
});

// ---------------------------------------------------------------- schema load

test('the real schema.sql loads into PostgreSQL without modification', async () => {
  const res = await db.db.query(
    "SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'"
  );
  assert.ok(res.rows[0].n >= 27, `expected at least 27 tables, got ${res.rows[0].n}`);
});

// ------------------------------------------------------------------- patients

test('POST /api/patients persists using the real column names', async () => {
  const res = await call(api.base, 'POST', '/api/patients', {
    token: users.Receptionist.token,
    body: {
      mrn: 'MRN-0001',
      first_name: 'Bekele',
      last_name: 'Tadesse',
      date_of_birth: '1988-04-12',
      gender: 'M',
      phone: '+251911234567',
      city: 'Bule Hora',
      blood_type: 'O+',
    },
  });

  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  assert.ok(res.body.patient_id, 'response must expose patient_id, not id');
  assert.strictEqual(res.body.phone, '+251911234567');
  assert.strictEqual(res.body.status, 'Active');
  assert.strictEqual(res.body.country, 'Ethiopia', 'schema default should apply');
  assert.strictEqual(res.body.id, undefined);
  assert.strictEqual(res.body.contact_number, undefined);

  patientId = res.body.patient_id;
});

test('GET /api/patients/:id retrieves by patient_id', async () => {
  const res = await call(api.base, 'GET', `/api/patients/${patientId}`, {
    token: users.Physician.token,
  });
  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(res.body.mrn, 'MRN-0001');
});

test('GET /api/patients paginates and searches by name or MRN', async () => {
  const all = await call(api.base, 'GET', '/api/patients?limit=5', {
    token: users.Physician.token,
  });
  assert.strictEqual(all.status, 200);
  assert.strictEqual(all.body.pagination.total, 1);

  const byName = await call(api.base, 'GET', '/api/patients?search=Bekele', {
    token: users.Physician.token,
  });
  assert.strictEqual(byName.body.data.length, 1);

  const byMrn = await call(api.base, 'GET', '/api/patients?search=MRN-000', {
    token: users.Physician.token,
  });
  assert.strictEqual(byMrn.body.data.length, 1);

  const miss = await call(api.base, 'GET', '/api/patients?search=nobodyhere', {
    token: users.Physician.token,
  });
  assert.strictEqual(miss.body.data.length, 0);
});

test('a duplicate MRN returns 409, not a 500 from the unique constraint', async () => {
  const res = await call(api.base, 'POST', '/api/patients', {
    token: users.Receptionist.token,
    body: {
      mrn: 'MRN-0001',
      first_name: 'Other',
      last_name: 'Person',
      date_of_birth: '1990-01-01',
      gender: 'F',
      phone: '+251911000000',
    },
  });
  assert.strictEqual(res.status, 409, JSON.stringify(res.body));
  await warm(api.base);
});

test('a missing NOT NULL field returns 400 with the field named', async () => {
  const res = await call(api.base, 'POST', '/api/patients', {
    token: users.Receptionist.token,
    body: { mrn: 'MRN-0002', first_name: 'No', last_name: 'Phone', date_of_birth: '1990-01-01', gender: 'F' },
  });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /phone/);
});

test('a gender outside the CHECK constraint returns 400 with the allowed values', async () => {
  const res = await call(api.base, 'POST', '/api/patients', {
    token: users.Receptionist.token,
    body: {
      mrn: 'MRN-0003', first_name: 'Bad', last_name: 'Gender',
      date_of_birth: '1990-01-01', gender: 'male', phone: '+251911000001',
    },
  });
  assert.strictEqual(res.status, 400);
  assert.deepStrictEqual(res.body.details.allowed, ['M', 'F', 'Other']);
});

test('a malformed UUID returns 400 rather than a Postgres cast error', async () => {
  const res = await call(api.base, 'GET', '/api/patients/1', { token: users.Physician.token });
  assert.strictEqual(res.status, 400);
});

test('an unknown but well-formed patient_id returns 404', async () => {
  const res = await call(api.base, 'GET', '/api/patients/3f6d1c0e-4a2b-4c7d-9e1f-0a1b2c3d4e5f', {
    token: users.Physician.token,
  });
  assert.strictEqual(res.status, 404);
});

// --------------------------------------------------------------- appointments

test('POST /api/appointments writes appointment_date and defaults doctor_id for a Physician', async () => {
  const res = await call(api.base, 'POST', '/api/appointments', {
    token: users.Physician.token,
    body: {
      patient_id: patientId,
      appointment_date: '2026-09-01T09:30:00Z',
      appointment_type: 'Follow-up',
      notes: 'Post-discharge review',
    },
  });
  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  assert.strictEqual(res.body.doctor_id, users.Physician.userId);
  assert.strictEqual(res.body.status, 'Scheduled');
  assert.strictEqual(new Date(res.body.appointment_date).toISOString(), '2026-09-01T09:30:00.000Z');
});

test('a Receptionist must name the doctor, since their own id would be wrong', async () => {
  const missing = await call(api.base, 'POST', '/api/appointments', {
    token: users.Receptionist.token,
    body: { patient_id: patientId, appointment_date: '2026-09-02T10:00:00Z' },
  });
  assert.strictEqual(missing.status, 400);
  assert.match(missing.body.error, /doctor_id/);

  const supplied = await call(api.base, 'POST', '/api/appointments', {
    token: users.Receptionist.token,
    body: {
      patient_id: patientId,
      doctor_id: users.Physician.userId,
      appointment_date: '2026-09-02T10:00:00Z',
    },
  });
  assert.strictEqual(supplied.status, 201, JSON.stringify(supplied.body));
});

test('a doctor_id that is not a real user returns 400 from the foreign key', async () => {
  // eslint-disable-next-line no-unused-expressions
  const res = await call(api.base, 'POST', '/api/appointments', {
    token: users.Receptionist.token,
    body: {
      patient_id: patientId,
      doctor_id: '3f6d1c0e-4a2b-4c7d-9e1f-0a1b2c3d4e5f',
      appointment_date: '2026-09-03T10:00:00Z',
    },
  });
  assert.strictEqual(res.status, 400, JSON.stringify(res.body));
  await warm(api.base);
});

test('GET /api/appointments joins patient and doctor names and filters by date', async () => {
  const res = await call(api.base, 'GET', '/api/appointments?start_date=2026-09-01&end_date=2026-09-01', {
    token: users.Physician.token,
  });
  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(res.body.data.length, 1, 'end_date should include the whole day');
  assert.strictEqual(res.body.data[0].patient_last_name, 'Tadesse');
  assert.strictEqual(res.body.data[0].doctor_last_name, 'Physician');
});

test('a lowercase status filter still matches the capitalised constraint value', async () => {
  const res = await call(api.base, 'GET', '/api/appointments?status=scheduled', {
    token: users.Physician.token,
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.pagination.total, 2);
});

test('an invalid status filter returns 400 instead of silently matching nothing', async () => {
  const res = await call(api.base, 'GET', '/api/appointments?status=archived', {
    token: users.Physician.token,
  });
  assert.strictEqual(res.status, 400);
});

// ------------------------------------------------------------------ lab tests

test('POST /api/lab-tests fills ordered_by from the token and request_date from NOW()', async () => {
  const res = await call(api.base, 'POST', '/api/lab-tests', {
    token: users.Physician.token,
    body: {
      patient_id: patientId,
      test_type: 'Complete Blood Count',
      clinical_indication: 'Suspected anaemia',
      specimen_type: 'Blood',
      priority: 'urgent',
    },
  });
  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  assert.strictEqual(res.body.ordered_by, users.Physician.userId);
  assert.strictEqual(res.body.test_type, 'Complete Blood Count');
  assert.strictEqual(res.body.priority, 'Urgent', 'lowercase input should be canonicalised');
  assert.strictEqual(res.body.status, 'Pending');
  assert.ok(res.body.request_date, 'request_date is NOT NULL and must be populated');
});

test('a Lab_Technician can read tests but not order them', async () => {
  const read = await call(api.base, 'GET', '/api/lab-tests', { token: users.Lab_Technician.token });
  assert.strictEqual(read.status, 200);
  assert.strictEqual(read.body.data[0].ordered_by_last_name, 'Physician');

  const write = await call(api.base, 'POST', '/api/lab-tests', {
    token: users.Lab_Technician.token,
    body: { patient_id: patientId, test_type: 'Urinalysis' },
  });
  assert.strictEqual(write.status, 403);
});

// ---------------------------------------------------------------------- bills

test('POST /api/bills derives patient_responsibility and generates bill_number', async () => {
  const res = await call(api.base, 'POST', '/api/bills', {
    token: users.Accountant.token,
    body: {
      patient_id: patientId,
      total_amount: 1200,
      discount_amount: 100,
      insurance_amount: 800,
      service_date: '2026-08-20',
      due_date: '2026-09-20',
    },
  });
  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  assert.strictEqual(Number(res.body.patient_responsibility), 300);
  assert.strictEqual(res.body.status, 'Pending');
  assert.strictEqual(res.body.created_by, users.Accountant.userId);
  assert.match(res.body.bill_number, /^BHUTH-\d{8}-\d{4}$/);
});

test('bill_number stays unique across consecutive bills on the same day', async () => {
  const numbers = new Set();
  for (let i = 0; i < 3; i += 1) {
    const res = await call(api.base, 'POST', '/api/bills', {
      token: users.Accountant.token,
      body: { patient_id: patientId, total_amount: 50 },
    });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    numbers.add(res.body.bill_number);
  }
  assert.strictEqual(numbers.size, 3);
});

test('status is derived from paid_amount', async () => {
  const partial = await call(api.base, 'POST', '/api/bills', {
    token: users.Accountant.token,
    body: { patient_id: patientId, total_amount: 1000, paid_amount: 400 },
  });
  assert.strictEqual(partial.body.status, 'Partial');

  const paid = await call(api.base, 'POST', '/api/bills', {
    token: users.Accountant.token,
    body: { patient_id: patientId, total_amount: 200, paid_amount: 200 },
  });
  assert.strictEqual(paid.body.status, 'Paid');
});

test('a client cannot understate what a patient owes', async () => {
  const overClaim = await call(api.base, 'POST', '/api/bills', {
    token: users.Accountant.token,
    body: { patient_id: patientId, total_amount: 100, discount_amount: 60, insurance_amount: 60 },
  });
  assert.strictEqual(overClaim.status, 400);

  // patient_responsibility supplied by the client is ignored, not trusted.
  const injected = await call(api.base, 'POST', '/api/bills', {
    token: users.Accountant.token,
    body: { patient_id: patientId, total_amount: 500, patient_responsibility: 1 },
  });
  assert.strictEqual(injected.status, 201);
  assert.strictEqual(Number(injected.body.patient_responsibility), 500);
});

test('paid_amount cannot exceed what is owed', async () => {
  const res = await call(api.base, 'POST', '/api/bills', {
    token: users.Accountant.token,
    body: { patient_id: patientId, total_amount: 100, paid_amount: 500 },
  });
  assert.strictEqual(res.status, 400);
});

test('a negative amount is rejected', async () => {
  const res = await call(api.base, 'POST', '/api/bills', {
    token: users.Accountant.token,
    body: { patient_id: patientId, total_amount: -50 },
  });
  assert.strictEqual(res.status, 400);
});

// ------------------------------------------------------------------ analytics

test('the dashboard returns real figures rather than zeros', async () => {
  const res = await call(api.base, 'GET', '/api/analytics/dashboard', {
    token: users.Admin.token,
  });
  assert.strictEqual(res.status, 200, JSON.stringify(res.body));

  assert.strictEqual(res.body.active_patients, 1);
  assert.strictEqual(res.body.total_patients, 1);
  assert.strictEqual(res.body.appointments_upcoming, 2, 'capitalised Scheduled must match');
  assert.strictEqual(res.body.lab_tests_open, 1);
  assert.strictEqual(res.body.lab_tests_urgent, 1);

  // One Partial bill paid 400 and one Paid bill paid 200.
  assert.strictEqual(Number(res.body.revenue_this_month), 600);
  assert.ok(Number(res.body.outstanding_balance) > 0);
});

test('a Physician cannot read the revenue dashboard', async () => {
  const res = await call(api.base, 'GET', '/api/analytics/dashboard', {
    token: users.Physician.token,
  });
  assert.strictEqual(res.status, 403);
});

// ---------------------------------------------------------- auth against a DB

test('logout revokes the token immediately, before it expires', async () => {
  const login = await call(api.base, 'POST', '/api/auth/login', {
    body: { email: users.Admin.email, password: PASSWORD },
  });
  const { access_token: token } = login.body;

  assert.strictEqual((await call(api.base, 'GET', '/api/auth/me', { token })).status, 200);
  assert.strictEqual((await call(api.base, 'POST', '/api/auth/logout', { token })).status, 204);

  const after = await call(api.base, 'GET', '/api/auth/me', { token });
  assert.strictEqual(after.status, 401, 'a revoked token must stop working at once');
});

test('refresh rotates both tokens and invalidates the old refresh token', async () => {
  const login = await call(api.base, 'POST', '/api/auth/login', {
    body: { email: users.Accountant.email, password: PASSWORD },
  });
  const old = login.body.refresh_token;

  const rotated = await call(api.base, 'POST', '/api/auth/refresh', {
    body: { refresh_token: old },
  });
  assert.strictEqual(rotated.status, 200, JSON.stringify(rotated.body));
  assert.notStrictEqual(rotated.body.refresh_token, old);

  const replay = await call(api.base, 'POST', '/api/auth/refresh', {
    body: { refresh_token: old },
  });
  assert.strictEqual(replay.status, 401, 'a used refresh token must not work twice');
});

test('a wrong password is rejected and does not reveal whether the account exists', async () => {
  const wrongPassword = await call(api.base, 'POST', '/api/auth/login', {
    body: { email: users.Admin.email, password: 'not-the-password' },
  });
  const unknownEmail = await call(api.base, 'POST', '/api/auth/login', {
    body: { email: 'nobody@bhuth.test', password: 'not-the-password' },
  });

  assert.strictEqual(wrongPassword.status, 401);
  assert.strictEqual(unknownEmail.status, 401);
  assert.deepStrictEqual(wrongPassword.body, unknownEmail.body);
});

test('a deactivated account is refused without revealing that it exists', async () => {
  await db.db.query("UPDATE users SET is_active = false WHERE email = $1", [users.Lab_Technician.email]);
  const res = await call(api.base, 'POST', '/api/auth/login', {
    body: { email: users.Lab_Technician.email, password: PASSWORD },
  });
  assert.strictEqual(res.status, 401);
  assert.deepStrictEqual(res.body, { error: 'Invalid credentials' });
  await db.db.query("UPDATE users SET is_active = true WHERE email = $1", [users.Lab_Technician.email]);
});

// -------------------------------------------------------------- audit logging

test('patient reads and writes are recorded in audit_logs with the acting user', async () => {
  const { rows } = await db.db.query(
    `SELECT entity_type, action, user_id FROM audit_logs ORDER BY created_at`
  );
  assert.ok(rows.length > 0, 'audit_logs should not be empty');

  const created = rows.find((r) => r.entity_type === 'patient' && r.action === 'CREATE');
  assert.ok(created, 'patient creation must be audited');
  assert.strictEqual(created.user_id, users.Receptionist.userId);

  const read = rows.find((r) => r.entity_type === 'patient' && r.action === 'READ');
  assert.ok(read, 'patient reads must be audited');
});

test('audit_logs only contains actions its CHECK constraint allows', async () => {
  const { rows } = await db.db.query('SELECT DISTINCT action FROM audit_logs');
  for (const row of rows) {
    assert.ok(['CREATE', 'READ', 'UPDATE', 'DELETE'].includes(row.action), row.action);
  }
});
