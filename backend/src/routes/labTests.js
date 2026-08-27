const express = require('express');

const { pool } = require('../db');
const { requireRole } = require('../middleware/auth');
const { audit, writeAudit } = require('../middleware/audit');
const v = require('../validators');
const { buildUpdate, diff } = require('../updates');

const router = express.Router();

const SELECT_TEST = `
  SELECT t.test_id, t.patient_id, t.ordered_by, t.test_type, t.clinical_indication,
         t.specimen_type, t.request_date, t.specimen_date, t.status, t.priority,
         t.created_at,
         p.first_name AS patient_first_name, p.last_name AS patient_last_name, p.mrn,
         u.first_name AS ordered_by_first_name, u.last_name AS ordered_by_last_name
    FROM lab_tests t
    JOIN patients p ON p.patient_id = t.patient_id
    JOIN users    u ON u.user_id    = t.ordered_by
`;

/**
 * GET /api/lab-tests
 * Query: page, limit, patient_id, status, priority
 */
router.get(
  '/',
  requireRole('Admin', 'Physician', 'Nurse', 'Lab_Technician'),
  async (req, res, next) => {
    try {
      const { page, limit, offset } = v.pagination(req.query);
      const filters = [];
      const params = [];

      if (req.query.patient_id) {
        params.push(v.requireUuid(req.query.patient_id, 'patient_id'));
        filters.push(`t.patient_id = $${params.length}`);
      }
      const status = v.canonicalise(req.query.status, v.LAB_STATUSES, 'status');
      if (status) {
        params.push(status);
        filters.push(`t.status = $${params.length}`);
      }
      const priority = v.canonicalise(req.query.priority, v.LAB_PRIORITIES, 'priority');
      if (priority) {
        params.push(priority);
        filters.push(`t.priority = $${params.length}`);
      }

      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

      const rows = await pool.query(
        `${SELECT_TEST} ${where}
          ORDER BY t.request_date DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );
      const count = await pool.query(
        `SELECT COUNT(*)::int AS total FROM lab_tests t ${where}`,
        params
      );

      return res.json({
        data: rows.rows,
        pagination: { page, limit, total: count.rows[0].total },
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/lab-tests
 *
 * ordered_by and request_date are both NOT NULL with no default. ordered_by is
 * taken from the authenticated user rather than the request body - a clinician
 * should not be able to attribute an order to a colleague.
 */
router.post(
  '/',
  requireRole('Admin', 'Physician', 'Nurse'),
  audit('lab_test', 'CREATE', (req, body) => body?.test_id ?? '-'),
  async (req, res, next) => {
    try {
      const b = req.body || {};
      const { rows } = await pool.query(
        `INSERT INTO lab_tests
           (patient_id, ordered_by, test_type, clinical_indication, specimen_type,
            request_date, specimen_date, status, priority)
         VALUES ($1,$2,$3,$4,$5, NOW(), $6,$7,$8)
         RETURNING test_id, patient_id, ordered_by, test_type, clinical_indication,
                   specimen_type, request_date, specimen_date, status, priority, created_at`,
        [
          v.requireUuid(b.patient_id, 'patient_id'),
          req.user.userId,
          v.requireString(b.test_type, 'test_type', 100),
          v.optionalString(b.clinical_indication, 'clinical_indication'),
          v.optionalString(b.specimen_type, 'specimen_type', 50),
          b.specimen_date ? v.requireTimestamp(b.specimen_date, 'specimen_date') : null,
          v.canonicalise(b.status, v.LAB_STATUSES, 'status') || 'Pending',
          v.canonicalise(b.priority, v.LAB_PRIORITIES, 'priority') || 'Normal',
        ]
      );
      return res.status(201).json(rows[0]);
    } catch (err) {
      return next(err);
    }
  }
);

const TEST_RETURNING = `
  test_id, patient_id, ordered_by, test_type, clinical_indication,
  specimen_type, request_date, specimen_date, status, priority, created_at
`;

const UPDATE_HANDLERS = {
  test_type: (x) => v.requireString(x, 'test_type', 100),
  clinical_indication: (x) => v.optionalString(x, 'clinical_indication'),
  specimen_type: (x) => v.optionalString(x, 'specimen_type', 50),
  specimen_date: (x) => (x === null ? null : v.requireTimestamp(x, 'specimen_date')),
  status: (x) => v.canonicalise(x, v.LAB_STATUSES, 'status'),
  priority: (x) => v.canonicalise(x, v.LAB_PRIORITIES, 'priority'),
};

// A lab technician runs the test, so they move it through its statuses and
// record when the specimen was taken - but they do not decide which test was
// ordered or how urgent it is. Those belong to the ordering clinician.
const UPDATABLE_BY_ROLE = {
  Admin: Object.keys(UPDATE_HANDLERS),
  Physician: Object.keys(UPDATE_HANDLERS),
  Nurse: ['clinical_indication', 'specimen_type', 'specimen_date', 'status', 'priority'],
  Lab_Technician: ['specimen_type', 'specimen_date', 'status'],
};

/**
 * PATCH /api/lab-tests/:id
 *
 * lab_tests has no updated_at column in schema.sql, so there is nothing to touch
 * here; audit_logs is the only record of when a test changed. That makes the
 * audit write the point of this endpoint rather than a side effect of it.
 */
router.patch(
  '/:id',
  requireRole('Admin', 'Physician', 'Nurse', 'Lab_Technician'),
  async (req, res, next) => {
    const id = v.isUuid(req.params.id) ? req.params.id : null;
    if (!id) return next(new v.ValidationError('test_id must be a UUID'));

    const client = await pool.connect();
    try {
      const { assignments, params, changes } = buildUpdate(req.body, UPDATE_HANDLERS, {
        allowed: UPDATABLE_BY_ROLE[req.user.role] || [],
      });

      await client.query('BEGIN');

      const existing = await client.query(
        `SELECT ${TEST_RETURNING} FROM lab_tests WHERE test_id = $1 FOR UPDATE`,
        [id]
      );
      if (existing.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Lab test not found' });
      }

      const before = existing.rows[0];
      // A completed test has a result attached to it. Changing which test it was
      // after the fact would mislabel that result.
      if (before.status === 'Completed' && !['Admin', 'Physician'].includes(req.user.role)) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'A completed lab test cannot be modified',
          hint: 'Order a repeat test instead',
        });
      }

      const updated = await client.query(
        `UPDATE lab_tests SET ${assignments.join(', ')}
          WHERE test_id = $${params.length + 1}
          RETURNING ${TEST_RETURNING}`,
        [...params, id]
      );

      await client.query('COMMIT');

      const { oldValues, newValues, changed } = diff(before, changes);
      if (changed.length > 0) {
        await writeAudit({
          userId: req.user.userId,
          entityType: 'lab_test',
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
  }
);

/**
 * DELETE /api/lab-tests/:id
 *
 * Cancels the order. A cancelled test that was already collected still matters:
 * the specimen exists somewhere. ?purge=true is Admin only and refused once the
 * test is Completed, because that would orphan a released result.
 */
router.delete('/:id', requireRole('Admin', 'Physician', 'Nurse'), async (req, res, next) => {
  const id = v.isUuid(req.params.id) ? req.params.id : null;
  if (!id) return next(new v.ValidationError('test_id must be a UUID'));

  const purge = req.query.purge === 'true';
  if (purge && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Only an Admin may purge a lab test' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT ${TEST_RETURNING} FROM lab_tests WHERE test_id = $1 FOR UPDATE`,
      [id]
    );
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Lab test not found' });
    }
    const before = existing.rows[0];

    if (purge) {
      if (before.status === 'Completed') {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'A completed lab test cannot be purged',
          hint: 'Its result is part of the clinical record',
        });
      }
      await client.query(
        `INSERT INTO audit_logs
           (user_id, entity_type, entity_id, action, old_values, new_values, ip_address)
         VALUES ($1, 'lab_test', $2, 'DELETE', $3, $4, $5)`,
        [
          req.user.userId, id, JSON.stringify(before),
          JSON.stringify({ deleted: 'purge' }), req.ip || null,
        ]
      );
      await client.query('DELETE FROM lab_tests WHERE test_id = $1', [id]);
      await client.query('COMMIT');
      return res.json({ test_id: id, deleted: 'purge' });
    }

    if (before.status === 'Cancelled') {
      await client.query('ROLLBACK');
      return res.json({ ...before, deleted: 'soft', already_cancelled: true });
    }
    if (before.status === 'Completed') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'A completed lab test cannot be cancelled',
        hint: 'The result has already been recorded',
      });
    }

    const updated = await client.query(
      `UPDATE lab_tests SET status = 'Cancelled'
        WHERE test_id = $1 RETURNING ${TEST_RETURNING}`,
      [id]
    );
    await client.query('COMMIT');

    await writeAudit({
      userId: req.user.userId,
      entityType: 'lab_test',
      entityId: id,
      action: 'DELETE',
      oldValues: { status: before.status },
      newValues: { status: 'Cancelled', deleted: 'soft' },
      ip: req.ip,
      client,
    });

    return res.json({ ...updated.rows[0], deleted: 'soft' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
