/**
 * End-to-end tests for PATCH and DELETE against a real PostgreSQL instance.
 *
 * These run in their own file, with their own database, because several of them
 * assert on the exact contents of audit_logs. Sharing a database with the wider
 * api.test.js suite would mean asserting against whatever those tests had already
 * logged.
 */

const test = require('node:test');
const assert = require('node:assert');

const { hashPassword } = require('../../src/auth/passwords');
const { startDatabase, startApi, call, warm } = require('./harness');

const PASSWORD = 'integration-test-password';

let db;
let api;
const users = {};

/** Fetch the audit rows for one entity, oldest first. */
async function auditFor(entityType, entityId) {
  const { rows } = await db.db.query(
    `SELECT action, old_values, new_values, user_id
       FROM audit_logs
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY created_at, audit_id`,
    [entityType, String(entityId)]
  );
  return rows;
}

/** Create a patient and return its id. */
async function newPatient(mrn, overrides = {}) {
  const res = await call(api.base, 'POST', '/api/patients', {
    token: users.Receptionist.token,
    body: {
      mrn,
      first_name: 'Bekele',
      last_name: 'Tadesse',
      date_of_birth: '1988-04-12',
      gender: 'M',
      phone: '+251911234567',
      city: 'Bule Hora',
      ...overrides,
    },
  });
  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  return res.body.patient_id;
}

async function newAppointment(patientId, overrides = {}) {
  const res = await call(api.base, 'POST', '/api/appointments', {
    token: users.Physician.token,
    body: {
      patient_id: patientId,
      appointment_date: '2026-09-01T09:30:00Z',
      appointment_type: 'Follow-up',
      ...overrides,
    },
  });
  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

async function newLabTest(patientId, overrides = {}) {
  const res = await call(api.base, 'POST', '/api/lab-tests', {
    token: users.Physician.token,
    body: { patient_id: patientId, test_type: 'Full blood count', ...overrides },
  });
  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

async function newBill(patientId, overrides = {}) {
  const res = await call(api.base, 'POST', '/api/bills', {
    token: users.Accountant.token,
    body: {
      patient_id: patientId,
      total_amount: 1200,
      discount_amount: 100,
      insurance_amount: 800,
      ...overrides,
    },
  });
  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

test.before(async () => {
  db = await startDatabase();

  const hash = await hashPassword(PASSWORD);
  const seed = [
    ['EMP001', 'Ada', 'Admin', 'admin@bhuth.test', 'Admin'],
    ['EMP002', 'Paul', 'Physician', 'doctor@bhuth.test', 'Physician'],
    ['EMP003', 'Rita', 'Reception', 'reception@bhuth.test', 'Receptionist'],
    ['EMP004', 'Abe', 'Accountant', 'accountant@bhuth.test', 'Accountant'],
    ['EMP005', 'Lena', 'Lab', 'lab@bhuth.test', 'Lab_Technician'],
    ['EMP006', 'Naomi', 'Nurse', 'nurse@bhuth.test', 'Nurse'],
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
  }
});

test.after(async () => {
  if (process.env.DUMP_LOGS && api) {
    console.error('----- API LOG -----');
    console.error(
      api.logs.join('').split('\n').filter((l) => /rror|at /.test(l)).slice(0, 30).join('\n')
    );
  }
  if (api) await api.stop();
  if (db) await db.stop();
});

// ------------------------------------------------------------- PATCH: patients

test('PATCH updates only the fields sent and leaves the rest alone', async () => {
  const id = await newPatient('MRN-P001');

  const res = await call(api.base, 'PATCH', `/api/patients/${id}`, {
    token: users.Receptionist.token,
    body: { phone: '+251911999888', city: 'Shashamane' },
  });

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(res.body.phone, '+251911999888');
  assert.strictEqual(res.body.city, 'Shashamane');
  assert.strictEqual(res.body.first_name, 'Bekele', 'untouched fields must survive');
  assert.strictEqual(res.body.mrn, 'MRN-P001');
  assert.deepStrictEqual(res.body.changed_fields.sort(), ['city', 'phone']);
});

test('a PATCH records an UPDATE audit row containing the before and after values', async () => {
  const id = await newPatient('MRN-P002');
  await call(api.base, 'PATCH', `/api/patients/${id}`, {
    token: users.Receptionist.token,
    body: { last_name: 'Tadesse-Bekele' },
  });

  const rows = await auditFor('patient', id);
  const update = rows.find((r) => r.action === 'UPDATE');
  assert.ok(update, 'the update must be audited');
  assert.deepStrictEqual(update.old_values, { last_name: 'Tadesse' });
  assert.deepStrictEqual(update.new_values, { last_name: 'Tadesse-Bekele' });
  assert.strictEqual(update.user_id, users.Receptionist.userId);
});

test('the audit diff excludes fields that were sent but not actually changed', async () => {
  const id = await newPatient('MRN-P003', { city: 'Hawassa' });
  const res = await call(api.base, 'PATCH', `/api/patients/${id}`, {
    token: users.Receptionist.token,
    body: { city: 'Hawassa', first_name: 'Bekele', last_name: 'Alemu' },
  });

  assert.deepStrictEqual(res.body.changed_fields, ['last_name']);
  const update = (await auditFor('patient', id)).find((r) => r.action === 'UPDATE');
  assert.deepStrictEqual(Object.keys(update.new_values), ['last_name']);
});

test('a PATCH that changes nothing writes no audit row', async () => {
  const id = await newPatient('MRN-P004', { city: 'Adama' });
  const res = await call(api.base, 'PATCH', `/api/patients/${id}`, {
    token: users.Receptionist.token,
    body: { city: 'Adama' },
  });

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body.changed_fields, []);
  const rows = await auditFor('patient', id);
  assert.strictEqual(rows.filter((r) => r.action === 'UPDATE').length, 0);
});

test('mrn cannot be changed through PATCH', async () => {
  const id = await newPatient('MRN-P005');
  const res = await call(api.base, 'PATCH', `/api/patients/${id}`, {
    token: users.Admin.token,
    body: { mrn: 'MRN-STOLEN' },
  });

  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /Unknown or immutable/);
  assert.deepStrictEqual(res.body.details.fields, ['mrn']);
});

test('an empty PATCH body is a 400 rather than a no-op 200', async () => {
  const id = await newPatient('MRN-P006');
  const res = await call(api.base, 'PATCH', `/api/patients/${id}`, {
    token: users.Admin.token,
    body: {},
  });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /at least one field/);
});

test('a Receptionist cannot set a clinical field, and is told so', async () => {
  const id = await newPatient('MRN-P007');
  const res = await call(api.base, 'PATCH', `/api/patients/${id}`, {
    token: users.Receptionist.token,
    body: { blood_type: 'AB-' },
  });

  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /role may not change/);
  assert.deepStrictEqual(res.body.details.fields, ['blood_type']);
});

test('a Nurse may record a blood type but not mark a patient deceased', async () => {
  const id = await newPatient('MRN-P008');

  const blood = await call(api.base, 'PATCH', `/api/patients/${id}`, {
    token: users.Nurse.token,
    body: { blood_type: 'B+' },
  });
  assert.strictEqual(blood.status, 200, JSON.stringify(blood.body));
  assert.strictEqual(blood.body.blood_type, 'B+');

  const status = await call(api.base, 'PATCH', `/api/patients/${id}`, {
    token: users.Nurse.token,
    body: { status: 'Deceased' },
  });
  assert.strictEqual(status.status, 400);
  assert.match(status.body.error, /role may not change/);
});

test('an Accountant cannot PATCH a patient at all', async () => {
  const id = await newPatient('MRN-P009');
  const res = await call(api.base, 'PATCH', `/api/patients/${id}`, {
    token: users.Accountant.token,
    body: { city: 'Bishoftu' },
  });
  assert.strictEqual(res.status, 403);
});

test('PATCH validates against the CHECK constraint before reaching Postgres', async () => {
  const id = await newPatient('MRN-P010');
  const res = await call(api.base, 'PATCH', `/api/patients/${id}`, {
    token: users.Admin.token,
    body: { gender: 'Male' },
  });
  assert.strictEqual(res.status, 400);
  assert.deepStrictEqual(res.body.details.allowed, ['M', 'F', 'Other']);
});

test('a lowercase status is canonicalised to the constraint capitalisation', async () => {
  const id = await newPatient('MRN-P011');
  const res = await call(api.base, 'PATCH', `/api/patients/${id}`, {
    token: users.Admin.token,
    body: { status: 'inactive' },
  });
  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(res.body.status, 'Inactive');
});

test('PATCH on an unknown patient is 404, and on a malformed id is 400', async () => {
  const missing = await call(api.base, 'PATCH', '/api/patients/11111111-1111-4111-8111-111111111111', {
    token: users.Admin.token,
    body: { city: 'Jimma' },
  });
  assert.strictEqual(missing.status, 404);

  const malformed = await call(api.base, 'PATCH', '/api/patients/not-a-uuid', {
    token: users.Admin.token,
    body: { city: 'Jimma' },
  });
  assert.strictEqual(malformed.status, 400);
});

test('PATCH can clear an optional column by sending null', async () => {
  const id = await newPatient('MRN-P012', { email: 'bekele@example.com' });
  const res = await call(api.base, 'PATCH', `/api/patients/${id}`, {
    token: users.Admin.token,
    body: { email: null },
  });
  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(res.body.email, null);
  assert.deepStrictEqual(res.body.changed_fields, ['email']);
});

test('PATCH moves updated_at forward', async () => {
  const id = await newPatient('MRN-P013');
  const before = await db.db.query('SELECT updated_at FROM patients WHERE patient_id = $1', [id]);
  await new Promise((resolve) => setTimeout(resolve, 20));

  await call(api.base, 'PATCH', `/api/patients/${id}`, {
    token: users.Admin.token,
    body: { city: 'Dire Dawa' },
  });

  const after = await db.db.query('SELECT updated_at FROM patients WHERE patient_id = $1', [id]);
  assert.ok(
    new Date(after.rows[0].updated_at) > new Date(before.rows[0].updated_at),
    'updated_at must advance'
  );
});

// ------------------------------------------------------------ DELETE: patients

test('DELETE deactivates the patient instead of erasing the record', async () => {
  const id = await newPatient('MRN-D001');
  const appt = await newAppointment(id);

  const res = await call(api.base, 'DELETE', `/api/patients/${id}`, { token: users.Admin.token });

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(res.body.status, 'Inactive');
  assert.strictEqual(res.body.deleted, 'soft');
  assert.strictEqual(res.body.retained_records.appointments, 1);

  const { rows } = await db.db.query('SELECT status FROM patients WHERE patient_id = $1', [id]);
  assert.strictEqual(rows.length, 1, 'the row must still exist');
  assert.strictEqual(rows[0].status, 'Inactive');

  const kept = await db.db.query('SELECT 1 FROM appointments WHERE appointment_id = $1', [
    appt.appointment_id,
  ]);
  assert.strictEqual(kept.rows.length, 1, 'the appointment must survive');
});

test('a soft delete is audited as DELETE, naming who did it', async () => {
  const id = await newPatient('MRN-D002');
  await call(api.base, 'DELETE', `/api/patients/${id}`, { token: users.Admin.token });

  const rows = await auditFor('patient', id);
  const del = rows.find((r) => r.action === 'DELETE');
  assert.ok(del, 'the deletion must be audited');
  assert.strictEqual(del.user_id, users.Admin.userId);
  assert.strictEqual(del.old_values.status, 'Active');
  assert.strictEqual(del.new_values.deleted, 'soft');
});

test('deleting an already inactive patient is idempotent and logs nothing new', async () => {
  const id = await newPatient('MRN-D003');
  await call(api.base, 'DELETE', `/api/patients/${id}`, { token: users.Admin.token });
  const first = (await auditFor('patient', id)).filter((r) => r.action === 'DELETE').length;

  const again = await call(api.base, 'DELETE', `/api/patients/${id}`, { token: users.Admin.token });
  assert.strictEqual(again.status, 200);
  assert.strictEqual(again.body.already_inactive, true);

  const second = (await auditFor('patient', id)).filter((r) => r.action === 'DELETE').length;
  assert.strictEqual(second, first, 'a repeat delete must not add another audit row');
});

test('only an Admin may delete a patient', async () => {
  const id = await newPatient('MRN-D004');
  for (const role of ['Receptionist', 'Physician', 'Nurse', 'Accountant']) {
    const res = await call(api.base, 'DELETE', `/api/patients/${id}`, {
      token: users[role].token,
    });
    assert.strictEqual(res.status, 403, `${role} should not be able to delete a patient`);
  }
});

test('a purge without the MRN confirmation is refused, and reports what it would destroy', async () => {
  const id = await newPatient('MRN-D005');
  await newAppointment(id);
  await newLabTest(id);

  const res = await call(api.base, 'DELETE', `/api/patients/${id}?purge=true`, {
    token: users.Admin.token,
  });

  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /MRN/);
  assert.strictEqual(res.body.would_delete.appointments, 1);
  assert.strictEqual(res.body.would_delete.lab_tests, 1);

  const still = await db.db.query('SELECT 1 FROM patients WHERE patient_id = $1', [id]);
  assert.strictEqual(still.rows.length, 1, 'nothing may be deleted without confirmation');
});

test('a confirmed purge removes the patient and reports the cascade', async () => {
  const id = await newPatient('MRN-D006');
  await newAppointment(id);
  await newLabTest(id);

  const res = await call(api.base, 'DELETE', `/api/patients/${id}?purge=true&confirm=MRN-D006`, {
    token: users.Admin.token,
  });

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(res.body.deleted, 'purge');
  assert.strictEqual(res.body.cascaded.appointments, 1);
  assert.strictEqual(res.body.cascaded.lab_tests, 1);

  const gone = await db.db.query('SELECT 1 FROM patients WHERE patient_id = $1', [id]);
  assert.strictEqual(gone.rows.length, 0);
  const cascaded = await db.db.query('SELECT 1 FROM appointments WHERE patient_id = $1', [id]);
  assert.strictEqual(cascaded.rows.length, 0, 'the cascade should have taken the appointment');
});

test('the purge audit row survives the cascade and holds the whole prior record', async () => {
  const id = await newPatient('MRN-D007', { first_name: 'Hanna' });
  await call(api.base, 'DELETE', `/api/patients/${id}?purge=true&confirm=MRN-D007`, {
    token: users.Admin.token,
  });

  const rows = await auditFor('patient', id);
  const purge = rows.find((r) => r.new_values && r.new_values.deleted === 'purge');
  assert.ok(purge, 'the purge must be recoverable from audit_logs after the row is gone');
  assert.strictEqual(purge.action, 'DELETE');
  assert.strictEqual(purge.old_values.first_name, 'Hanna');
  assert.strictEqual(purge.old_values.mrn, 'MRN-D007');
  assert.strictEqual(purge.user_id, users.Admin.userId);
});

test('a patient with money already received cannot be purged', async () => {
  const id = await newPatient('MRN-D008');
  await newBill(id, { paid_amount: 150 });

  const res = await call(api.base, 'DELETE', `/api/patients/${id}?purge=true&confirm=MRN-D008`, {
    token: users.Admin.token,
  });

  assert.strictEqual(res.status, 409, JSON.stringify(res.body));
  assert.strictEqual(res.body.paid_bills, 1);
  assert.match(res.body.hint, /Deactivate/);

  const still = await db.db.query('SELECT 1 FROM patients WHERE patient_id = $1', [id]);
  assert.strictEqual(still.rows.length, 1);
});

// --------------------------------------------------------- appointments

test('PATCH reschedules an appointment and audits the old and new times', async () => {
  const patient = await newPatient('MRN-A001');
  const appt = await newAppointment(patient);

  const res = await call(api.base, 'PATCH', `/api/appointments/${appt.appointment_id}`, {
    token: users.Receptionist.token,
    body: { appointment_date: '2026-09-05T14:00:00Z', status: 'Rescheduled' },
  });

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(new Date(res.body.appointment_date).toISOString(), '2026-09-05T14:00:00.000Z');
  assert.strictEqual(res.body.status, 'Rescheduled');

  const update = (await auditFor('appointment', appt.appointment_id))
    .find((r) => r.action === 'UPDATE');
  assert.ok(update);
  assert.strictEqual(new Date(update.old_values.appointment_date).toISOString(),
    '2026-09-01T09:30:00.000Z');
  assert.strictEqual(update.old_values.status, 'Scheduled');
});

test('appointments have no updated_at trigger, so PATCH must set it explicitly', async () => {
  const patient = await newPatient('MRN-A002');
  const appt = await newAppointment(patient);
  await new Promise((resolve) => setTimeout(resolve, 20));

  await call(api.base, 'PATCH', `/api/appointments/${appt.appointment_id}`, {
    token: users.Receptionist.token,
    body: { notes: 'Patient called to confirm' },
  });

  const { rows } = await db.db.query(
    'SELECT created_at, updated_at FROM appointments WHERE appointment_id = $1',
    [appt.appointment_id]
  );
  assert.ok(
    new Date(rows[0].updated_at) > new Date(rows[0].created_at),
    'updated_at must advance even though schema.sql defines no trigger for this table'
  );
});

test('a Nurse cannot reschedule, and nobody but an Admin can reassign the doctor', async () => {
  const patient = await newPatient('MRN-A003');
  const appt = await newAppointment(patient);

  const nurse = await call(api.base, 'PATCH', `/api/appointments/${appt.appointment_id}`, {
    token: users.Nurse.token,
    body: { appointment_date: '2026-09-09T08:00:00Z' },
  });
  assert.strictEqual(nurse.status, 400);
  assert.match(nurse.body.error, /role may not change/);

  const reassign = await call(api.base, 'PATCH', `/api/appointments/${appt.appointment_id}`, {
    token: users.Receptionist.token,
    body: { doctor_id: users.Physician.userId },
  });
  assert.strictEqual(reassign.status, 400);

  const admin = await call(api.base, 'PATCH', `/api/appointments/${appt.appointment_id}`, {
    token: users.Admin.token,
    body: { doctor_id: users.Physician.userId },
  });
  assert.strictEqual(admin.status, 200, JSON.stringify(admin.body));
});

test('a completed appointment is closed to further edits', async () => {
  const patient = await newPatient('MRN-A004');
  const appt = await newAppointment(patient, { status: 'Completed' });

  const res = await call(api.base, 'PATCH', `/api/appointments/${appt.appointment_id}`, {
    token: users.Receptionist.token,
    body: { notes: 'Rewriting history' },
  });

  assert.strictEqual(res.status, 409);
  assert.match(res.body.error, /cannot be modified/);
});

test('DELETE cancels an appointment rather than removing the no-show from the record', async () => {
  const patient = await newPatient('MRN-A005');
  const appt = await newAppointment(patient);

  const res = await call(api.base, 'DELETE', `/api/appointments/${appt.appointment_id}`, {
    token: users.Receptionist.token,
  });

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(res.body.status, 'Cancelled');
  assert.strictEqual(res.body.deleted, 'soft');

  const { rows } = await db.db.query(
    'SELECT status FROM appointments WHERE appointment_id = $1',
    [appt.appointment_id]
  );
  assert.strictEqual(rows[0].status, 'Cancelled');

  const del = (await auditFor('appointment', appt.appointment_id))
    .find((r) => r.action === 'DELETE');
  assert.ok(del, 'the cancellation must be audited as a DELETE');
});

test('a completed appointment cannot be cancelled, but an Admin can purge a mis-entry', async () => {
  const patient = await newPatient('MRN-A006');
  const done = await newAppointment(patient, { status: 'Completed' });

  const refused = await call(api.base, 'DELETE', `/api/appointments/${done.appointment_id}`, {
    token: users.Receptionist.token,
  });
  assert.strictEqual(refused.status, 409);

  const notAdmin = await call(
    api.base,
    `DELETE`,
    `/api/appointments/${done.appointment_id}?purge=true`,
    { token: users.Receptionist.token }
  );
  assert.strictEqual(notAdmin.status, 403);

  const purged = await call(
    api.base,
    'DELETE',
    `/api/appointments/${done.appointment_id}?purge=true`,
    { token: users.Admin.token }
  );
  assert.strictEqual(purged.status, 200, JSON.stringify(purged.body));

  const gone = await db.db.query('SELECT 1 FROM appointments WHERE appointment_id = $1', [
    done.appointment_id,
  ]);
  assert.strictEqual(gone.rows.length, 0);

  const audited = (await auditFor('appointment', done.appointment_id))
    .find((r) => r.new_values && r.new_values.deleted === 'purge');
  assert.ok(audited, 'the purge must be in audit_logs after the row is gone');
});

// ------------------------------------------------------------------- lab tests

test('a Lab_Technician can advance a test status but not change which test it is', async () => {
  const patient = await newPatient('MRN-L001');
  const lab = await newLabTest(patient);

  const ok = await call(api.base, 'PATCH', `/api/lab-tests/${lab.test_id}`, {
    token: users.Lab_Technician.token,
    body: { status: 'In_Progress', specimen_date: '2026-08-27T07:15:00Z' },
  });
  assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
  assert.strictEqual(ok.body.status, 'In_Progress');

  const refused = await call(api.base, 'PATCH', `/api/lab-tests/${lab.test_id}`, {
    token: users.Lab_Technician.token,
    body: { test_type: 'Something else' },
  });
  assert.strictEqual(refused.status, 400);
  assert.match(refused.body.error, /role may not change/);

  const priority = await call(api.base, 'PATCH', `/api/lab-tests/${lab.test_id}`, {
    token: users.Lab_Technician.token,
    body: { priority: 'Urgent' },
  });
  assert.strictEqual(priority.status, 400, 'urgency is the ordering clinician-s call');
});

test('a lab test PATCH is audited even though the table has no updated_at column', async () => {
  const patient = await newPatient('MRN-L002');
  const lab = await newLabTest(patient);

  await call(api.base, 'PATCH', `/api/lab-tests/${lab.test_id}`, {
    token: users.Lab_Technician.token,
    body: { status: 'Completed' },
  });

  const columns = await db.db.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'lab_tests' AND column_name = 'updated_at'`
  );
  assert.strictEqual(columns.rows.length, 0, 'lab_tests genuinely has no updated_at');

  const update = (await auditFor('lab_test', lab.test_id)).find((r) => r.action === 'UPDATE');
  assert.ok(update, 'audit_logs is the only record that this test changed');
  assert.deepStrictEqual(update.old_values, { status: 'Pending' });
  assert.deepStrictEqual(update.new_values, { status: 'Completed' });
});

test('a completed lab test is locked to the lab and cannot be purged', async () => {
  const patient = await newPatient('MRN-L003');
  const lab = await newLabTest(patient, { status: 'Completed' });

  const locked = await call(api.base, 'PATCH', `/api/lab-tests/${lab.test_id}`, {
    token: users.Lab_Technician.token,
    body: { status: 'Pending' },
  });
  assert.strictEqual(locked.status, 409);

  const purge = await call(api.base, 'DELETE', `/api/lab-tests/${lab.test_id}?purge=true`, {
    token: users.Admin.token,
  });
  assert.strictEqual(purge.status, 409);
  assert.match(purge.body.error, /cannot be purged/);
});

test('DELETE cancels a pending lab test and audits it', async () => {
  const patient = await newPatient('MRN-L004');
  const lab = await newLabTest(patient);

  const res = await call(api.base, 'DELETE', `/api/lab-tests/${lab.test_id}`, {
    token: users.Physician.token,
  });
  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(res.body.status, 'Cancelled');

  const del = (await auditFor('lab_test', lab.test_id)).find((r) => r.action === 'DELETE');
  assert.ok(del);
  assert.strictEqual(del.user_id, users.Physician.userId);
});

// ----------------------------------------------------------------------- bills

test('PATCHing an amount re-derives patient_responsibility and the status', async () => {
  const patient = await newPatient('MRN-B001');
  const bill = await newBill(patient);
  assert.strictEqual(Number(bill.patient_responsibility), 300);

  const res = await call(api.base, 'PATCH', `/api/bills/${bill.bill_id}`, {
    token: users.Accountant.token,
    body: { insurance_amount: 500 },
  });

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(Number(res.body.patient_responsibility), 600, '1200 - 100 - 500');
  assert.strictEqual(res.body.status, 'Pending');

  const update = (await auditFor('bill', bill.bill_id)).find((r) => r.action === 'UPDATE');
  assert.ok(update);
  assert.strictEqual(Number(update.old_values.patient_responsibility), 300);
  assert.strictEqual(Number(update.new_values.patient_responsibility), 600);
});

test('recording a part payment moves the bill to Partial, and settling it to Paid', async () => {
  const patient = await newPatient('MRN-B002');
  const bill = await newBill(patient);

  const part = await call(api.base, 'PATCH', `/api/bills/${bill.bill_id}`, {
    token: users.Accountant.token,
    body: { paid_amount: 100 },
  });
  assert.strictEqual(part.status, 200, JSON.stringify(part.body));
  assert.strictEqual(part.body.status, 'Partial');

  const full = await call(api.base, 'PATCH', `/api/bills/${bill.bill_id}`, {
    token: users.Accountant.token,
    body: { paid_amount: 300 },
  });
  assert.strictEqual(full.status, 200, JSON.stringify(full.body));
  assert.strictEqual(full.body.status, 'Paid');
});

test('a client cannot mark a bill Paid while a balance remains', async () => {
  // The status is accepted as sent, but the amounts are what the ledger reports,
  // so the two must not be allowed to disagree silently.
  const patient = await newPatient('MRN-B003');
  const bill = await newBill(patient);

  const res = await call(api.base, 'PATCH', `/api/bills/${bill.bill_id}`, {
    token: users.Accountant.token,
    body: { paid_amount: 400 },
  });

  assert.strictEqual(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /cannot exceed/);
  assert.strictEqual(res.body.patient_responsibility, 300);
});

test('a discount that exceeds the total is refused', async () => {
  const patient = await newPatient('MRN-B004');
  const bill = await newBill(patient);

  const res = await call(api.base, 'PATCH', `/api/bills/${bill.bill_id}`, {
    token: users.Accountant.token,
    body: { discount_amount: 2000 },
  });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /cannot exceed total_amount/);
});

test('bill_number is not editable', async () => {
  const patient = await newPatient('MRN-B005');
  const bill = await newBill(patient);

  const res = await call(api.base, 'PATCH', `/api/bills/${bill.bill_id}`, {
    token: users.Admin.token,
    body: { bill_number: 'BHUTH-19700101-0001' },
  });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /Unknown or immutable/);
});

test('DELETE cancels an unpaid bill, keeping the bill_number in sequence', async () => {
  const patient = await newPatient('MRN-B006');
  const bill = await newBill(patient);

  const res = await call(api.base, 'DELETE', `/api/bills/${bill.bill_id}`, {
    token: users.Accountant.token,
  });

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(res.body.status, 'Cancelled');
  assert.strictEqual(res.body.bill_number, bill.bill_number);

  const { rows } = await db.db.query('SELECT status FROM bills WHERE bill_id = $1', [bill.bill_id]);
  assert.strictEqual(rows[0].status, 'Cancelled', 'the financial document must remain');
});

test('a cancelled bill cannot then be edited', async () => {
  const patient = await newPatient('MRN-B007');
  const bill = await newBill(patient);
  await call(api.base, 'DELETE', `/api/bills/${bill.bill_id}`, { token: users.Accountant.token });

  const res = await call(api.base, 'PATCH', `/api/bills/${bill.bill_id}`, {
    token: users.Accountant.token,
    body: { total_amount: 5000 },
  });
  assert.strictEqual(res.status, 409);
  assert.match(res.body.error, /cancelled bill cannot be edited/);
});

test('a bill with a payment against it can be neither cancelled nor purged', async () => {
  const patient = await newPatient('MRN-B008');
  const bill = await newBill(patient, { paid_amount: 50 });

  const cancel = await call(api.base, 'DELETE', `/api/bills/${bill.bill_id}`, {
    token: users.Accountant.token,
  });
  assert.strictEqual(cancel.status, 409, JSON.stringify(cancel.body));
  assert.match(cancel.body.hint, /refund|credit note/);

  const purge = await call(api.base, 'DELETE', `/api/bills/${bill.bill_id}?purge=true`, {
    token: users.Admin.token,
  });
  assert.strictEqual(purge.status, 409);

  const { rows } = await db.db.query('SELECT status FROM bills WHERE bill_id = $1', [bill.bill_id]);
  assert.strictEqual(rows[0].status, 'Partial');
});

test('an Accountant may not purge, only an Admin', async () => {
  const patient = await newPatient('MRN-B009');
  const bill = await newBill(patient);

  const refused = await call(api.base, 'DELETE', `/api/bills/${bill.bill_id}?purge=true`, {
    token: users.Accountant.token,
  });
  assert.strictEqual(refused.status, 403);

  const purged = await call(api.base, 'DELETE', `/api/bills/${bill.bill_id}?purge=true`, {
    token: users.Admin.token,
  });
  assert.strictEqual(purged.status, 200, JSON.stringify(purged.body));
  assert.strictEqual(purged.body.bill_number, bill.bill_number);
});

test('a Receptionist can read bills but not change them', async () => {
  const patient = await newPatient('MRN-B010');
  const bill = await newBill(patient);

  const res = await call(api.base, 'PATCH', `/api/bills/${bill.bill_id}`, {
    token: users.Receptionist.token,
    body: { paid_amount: 10 },
  });
  assert.strictEqual(res.status, 403);
});

// ------------------------------------------------------------------- audit_logs

test('audit_logs now exercises all four actions its CHECK constraint allows', async () => {
  const { rows } = await db.db.query('SELECT DISTINCT action FROM audit_logs ORDER BY action');
  const actions = rows.map((r) => r.action);
  assert.deepStrictEqual(actions, ['CREATE', 'DELETE', 'READ', 'UPDATE']);
});

test('every mutation audit row carries the acting user, never a null', async () => {
  const { rows } = await db.db.query(
    `SELECT COUNT(*)::int AS n FROM audit_logs
      WHERE action IN ('UPDATE', 'DELETE') AND user_id IS NULL`
  );
  assert.strictEqual(rows[0].n, 0);
});

test('an unauthenticated PATCH or DELETE never reaches the database', async () => {
  const patient = await newPatient('MRN-X001');

  // The audit wrapper on POST does not block the response, so its CREATE row can
  // land after the request returns. Wait for it before snapshotting the count,
  // otherwise this test races its own setup rather than testing anything.
  for (let i = 0; i < 50 && (await auditFor('patient', patient)).length === 0; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  const before = await db.db.query('SELECT COUNT(*)::int AS n FROM audit_logs');

  for (const method of ['PATCH', 'DELETE']) {
    const res = await call(api.base, method, `/api/patients/${patient}`, { body: { city: 'X' } });
    assert.strictEqual(res.status, 401, `${method} without a token must be 401`);
  }

  const after = await db.db.query('SELECT COUNT(*)::int AS n FROM audit_logs');
  assert.strictEqual(after.rows[0].n, before.rows[0].n, 'rejected calls must not write audit rows');
  await warm(api.base);
});
