const express = require('express');

const { pool } = require('../db');
const { requireRole } = require('../middleware/auth');
const { audit, writeAudit } = require('../middleware/audit');
const v = require('../validators');
const { buildUpdate, diff } = require('../updates');

const router = express.Router();

// Columns safe to return. `SELECT *` would leak any column added later.
const PATIENT_COLUMNS = `
  patient_id, mrn, first_name, last_name, date_of_birth, gender, email, phone,
  address, city, state, postal_code, country, blood_type, status,
  created_at, updated_at
`;

const READ_ROLES = [
  'Admin', 'Physician', 'Nurse', 'Receptionist',
  'Lab_Technician', 'Radiologist', 'Accountant',
];
const WRITE_ROLES = ['Admin', 'Receptionist', 'Physician', 'Nurse'];

// mrn is deliberately absent: it is the identifier every other record and every
// paper chart refers to, so it is not editable through this endpoint.
const UPDATE_HANDLERS = {
  first_name: (x) => v.requireString(x, 'first_name', 100),
  last_name: (x) => v.requireString(x, 'last_name', 100),
  date_of_birth: (x) => v.requireDate(x, 'date_of_birth'),
  gender: (x) => v.canonicalise(x, v.GENDERS, 'gender'),
  phone: (x) => v.requireString(x, 'phone', 20),
  email: (x) => v.optionalString(x, 'email', 100),
  address: (x) => v.optionalString(x, 'address'),
  city: (x) => v.optionalString(x, 'city', 50),
  state: (x) => v.optionalString(x, 'state', 50),
  postal_code: (x) => v.optionalString(x, 'postal_code', 10),
  country: (x) => v.optionalString(x, 'country', 50),
  blood_type: (x) => (x === null || x === '' ? null : v.canonicalise(x, v.BLOOD_TYPES, 'blood_type')),
  status: (x) => v.canonicalise(x, v.PATIENT_STATUSES, 'status'),
};

const DEMOGRAPHICS = [
  'first_name', 'last_name', 'date_of_birth', 'gender', 'email', 'phone',
  'address', 'city', 'state', 'postal_code', 'country',
];

// blood_type is a clinical value and status includes 'Deceased', so neither is
// writable by reception. Nurses may record blood type but not change status.
const UPDATABLE_BY_ROLE = {
  Admin: Object.keys(UPDATE_HANDLERS),
  Physician: Object.keys(UPDATE_HANDLERS),
  Nurse: [...DEMOGRAPHICS, 'blood_type'],
  Receptionist: DEMOGRAPHICS,
};

/**
 * GET /api/patients
 * Query: page, limit, search (name or MRN), status
 */
router.get(
  '/',
  requireRole(...READ_ROLES),
  audit('patient', 'READ', () => 'list'),
  async (req, res, next) => {
    try {
      const { page, limit, offset } = v.pagination(req.query);
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const status = v.canonicalise(req.query.status, v.PATIENT_STATUSES, 'status');

      const filters = [];
      const params = [];

      if (search) {
        params.push(`%${search}%`);
        filters.push(
          `(first_name ILIKE $${params.length} OR last_name ILIKE $${params.length}
            OR mrn ILIKE $${params.length})`
        );
      }
      if (status) {
        params.push(status);
        filters.push(`status = $${params.length}`);
      }

      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

      const rows = await pool.query(
        `SELECT ${PATIENT_COLUMNS} FROM patients ${where}
          ORDER BY created_at DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      const count = await pool.query(`SELECT COUNT(*)::int AS total FROM patients ${where}`, params);

      return res.json({
        data: rows.rows,
        pagination: { page, limit, total: count.rows[0].total },
      });
    } catch (err) {
      return next(err);
    }
  }
);

/** GET /api/patients/:id */
router.get(
  '/:id',
  requireRole(...READ_ROLES),
  audit('patient', 'READ', (req) => req.params.id),
  async (req, res, next) => {
    try {
      v.requireUuid(req.params.id, 'patient_id');
      const { rows } = await pool.query(
        `SELECT ${PATIENT_COLUMNS} FROM patients WHERE patient_id = $1`,
        [req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
      return res.json(rows[0]);
    } catch (err) {
      return next(err);
    }
  }
);

/** POST /api/patients */
router.post(
  '/',
  requireRole(...WRITE_ROLES),
  audit('patient', 'CREATE', (req, body) => body?.patient_id ?? '-'),
  async (req, res, next) => {
    try {
      const b = req.body || {};

      const values = {
        mrn: v.requireString(b.mrn, 'mrn', 20),
        first_name: v.requireString(b.first_name, 'first_name', 100),
        last_name: v.requireString(b.last_name, 'last_name', 100),
        date_of_birth: v.requireDate(b.date_of_birth, 'date_of_birth'),
        gender: v.canonicalise(b.gender, v.GENDERS, 'gender'),
        phone: v.requireString(b.phone, 'phone', 20),
        email: v.optionalString(b.email, 'email', 100),
        address: v.optionalString(b.address, 'address'),
        city: v.optionalString(b.city, 'city', 50),
        state: v.optionalString(b.state, 'state', 50),
        postal_code: v.optionalString(b.postal_code, 'postal_code', 10),
        country: v.optionalString(b.country, 'country', 50) || 'Ethiopia',
        blood_type: b.blood_type
          ? v.canonicalise(b.blood_type, v.BLOOD_TYPES, 'blood_type')
          : null,
        status: v.canonicalise(b.status, v.PATIENT_STATUSES, 'status') || 'Active',
      };

      if (!values.gender) {
        throw new v.ValidationError('gender is required', { allowed: v.GENDERS });
      }

      const { rows } = await pool.query(
        `INSERT INTO patients
           (mrn, first_name, last_name, date_of_birth, gender, phone, email, address,
            city, state, postal_code, country, blood_type, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING ${PATIENT_COLUMNS}`,
        [
          values.mrn, values.first_name, values.last_name, values.date_of_birth,
          values.gender, values.phone, values.email, values.address, values.city,
          values.state, values.postal_code, values.country, values.blood_type,
          values.status,
        ]
      );

      return res.status(201).json(rows[0]);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'A patient with that MRN already exists' });
      }
      return next(err);
    }
  }
);

/**
 * PATCH /api/patients/:id
 *
 * Partial update. Only the fields present in the body are touched, and only if
 * the caller's role may write them. The row is locked and read inside a
 * transaction so audit_logs records the values that were actually replaced
 * rather than whatever a concurrent request left behind.
 */
router.patch('/:id', requireRole(...WRITE_ROLES), async (req, res, next) => {
  const id = v.isUuid(req.params.id) ? req.params.id : null;
  if (!id) return next(new v.ValidationError('patient_id must be a UUID'));

  const client = await pool.connect();
  try {
    const { assignments, params, changes } = buildUpdate(req.body, UPDATE_HANDLERS, {
      allowed: UPDATABLE_BY_ROLE[req.user.role] || [],
    });

    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT ${PATIENT_COLUMNS} FROM patients WHERE patient_id = $1 FOR UPDATE`,
      [id]
    );
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Patient not found' });
    }

    // patients has an updated_at trigger, but set it here too so the behaviour
    // does not depend on the trigger having been installed.
    const updated = await client.query(
      `UPDATE patients SET ${assignments.join(', ')}, updated_at = NOW()
        WHERE patient_id = $${params.length + 1}
        RETURNING ${PATIENT_COLUMNS}`,
      [...params, id]
    );

    await client.query('COMMIT');

    const { oldValues, newValues, changed } = diff(existing.rows[0], changes);

    if (changed.length > 0) {
      await writeAudit({
        userId: req.user.userId,
        entityType: 'patient',
        entityId: id,
        action: 'UPDATE',
        oldValues,
        newValues,
        ip: req.ip,
        client,
      });
    }

    return res.json({ ...updated.rows[0], changed_fields: changed });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return next(err);
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/patients/:id
 *
 * Deactivates the patient by default: status becomes 'Inactive' and the record
 * and its history stay intact. Nine tables reference patients with ON DELETE
 * CASCADE - patient_contacts, patient_insurance, patient_allergies,
 * medical_records, appointments, lab_tests, radiology_orders, prescriptions and
 * bills - so an unqualified row delete would silently erase an entire clinical
 * and financial history. That is the wrong default for a hospital, and it would
 * also destroy records that retention rules require keeping.
 *
 * A real delete is still available at ?purge=true, Admin only, and requires the
 * patient's MRN in ?confirm= so it cannot be triggered by a stray request. It is
 * refused outright when a bill has been paid.
 *
 * Either way the action is audited as DELETE with the full prior row.
 */
router.delete('/:id', requireRole('Admin'), async (req, res, next) => {
  const id = v.isUuid(req.params.id) ? req.params.id : null;
  if (!id) return next(new v.ValidationError('patient_id must be a UUID'));

  const purge = req.query.purge === 'true';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT ${PATIENT_COLUMNS} FROM patients WHERE patient_id = $1 FOR UPDATE`,
      [id]
    );
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Patient not found' });
    }
    const patient = existing.rows[0];

    // Count what a cascade would take with it, for the response and the audit
    // entry. Reported on the soft path too, so the caller can see the scale of
    // what they were about to destroy.
    const dependents = {};
    for (const table of [
      'patient_contacts', 'patient_insurance', 'patient_allergies', 'medical_records',
      'appointments', 'lab_tests', 'radiology_orders', 'prescriptions', 'bills',
    ]) {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS n FROM ${table} WHERE patient_id = $1`,
        [id]
      );
      if (rows[0].n > 0) dependents[table] = rows[0].n;
    }

    if (!purge) {
      if (patient.status === 'Inactive') {
        await client.query('ROLLBACK');
        return res.json({
          patient_id: id,
          status: 'Inactive',
          already_inactive: true,
          retained_records: dependents,
        });
      }

      const updated = await client.query(
        `UPDATE patients SET status = 'Inactive', updated_at = NOW()
          WHERE patient_id = $1 RETURNING ${PATIENT_COLUMNS}`,
        [id]
      );
      await client.query('COMMIT');

      await writeAudit({
        userId: req.user.userId,
        entityType: 'patient',
        entityId: id,
        action: 'DELETE',
        oldValues: { status: patient.status },
        newValues: { status: 'Inactive', deleted: 'soft', retained_records: dependents },
        ip: req.ip,
        client,
      });

      return res.json({ ...updated.rows[0], deleted: 'soft', retained_records: dependents });
    }

    // ---- purge path ----

    if (req.query.confirm !== patient.mrn) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Purge requires the patient MRN in the confirm parameter',
        expected_parameter: 'confirm=<mrn>',
        would_delete: dependents,
      });
    }

    const paid = await client.query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(paid_amount), 0) AS total
         FROM bills WHERE patient_id = $1 AND paid_amount > 0`,
      [id]
    );
    if (paid.rows[0].n > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Cannot purge a patient with settled bills',
        paid_bills: paid.rows[0].n,
        amount_received: paid.rows[0].total,
        hint: 'Deactivate the patient instead, or cancel and reconcile the bills first',
      });
    }

    // Audit before deleting, in the same transaction, and deliberately not via
    // writeAudit: that helper swallows its own errors so a failed audit can never
    // block a normal request. A purge is the one case where the opposite is
    // right - if the record of who destroyed the data cannot be written, the data
    // does not get destroyed. audit_logs.user_id is ON DELETE SET NULL and
    // entity_id is text, so the row survives the cascade.
    await client.query(
      `INSERT INTO audit_logs
         (user_id, entity_type, entity_id, action, old_values, new_values, ip_address)
       VALUES ($1, 'patient', $2, 'DELETE', $3, $4, $5)`,
      [
        req.user.userId,
        id,
        JSON.stringify(patient),
        JSON.stringify({ deleted: 'purge', cascaded: dependents }),
        req.ip || null,
      ]
    );

    await client.query('DELETE FROM patients WHERE patient_id = $1', [id]);
    await client.query('COMMIT');

    return res.json({ patient_id: id, mrn: patient.mrn, deleted: 'purge', cascaded: dependents });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
