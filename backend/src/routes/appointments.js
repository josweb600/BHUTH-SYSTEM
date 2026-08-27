const express = require('express');

const { pool } = require('../db');
const { requireRole } = require('../middleware/auth');
const { audit, writeAudit } = require('../middleware/audit');
const v = require('../validators');
const { buildUpdate, diff } = require('../updates');

const router = express.Router();

const READ_ROLES = ['Admin', 'Physician', 'Nurse', 'Receptionist'];
const WRITE_ROLES = ['Admin', 'Receptionist', 'Physician', 'Nurse'];

// appointment_date is a single TIMESTAMP WITH TIME ZONE. There is no separate
// time column, so both date and time come from this one field.
const SELECT_APPOINTMENT = `
  SELECT a.appointment_id, a.patient_id, a.doctor_id, a.appointment_date,
         a.status, a.appointment_type, a.notes, a.reminder_sent,
         a.created_at, a.updated_at,
         p.first_name AS patient_first_name, p.last_name AS patient_last_name, p.mrn,
         d.first_name AS doctor_first_name, d.last_name AS doctor_last_name
    FROM appointments a
    JOIN patients p ON p.patient_id = a.patient_id
    JOIN users   d ON d.user_id    = a.doctor_id
`;

/**
 * GET /api/appointments
 * Query: page, limit, patient_id, doctor_id, status, start_date, end_date
 */
router.get('/', requireRole(...READ_ROLES), async (req, res, next) => {
  try {
    const { page, limit, offset } = v.pagination(req.query);
    const filters = [];
    const params = [];

    if (req.query.patient_id) {
      params.push(v.requireUuid(req.query.patient_id, 'patient_id'));
      filters.push(`a.patient_id = $${params.length}`);
    }
    if (req.query.doctor_id) {
      params.push(v.requireUuid(req.query.doctor_id, 'doctor_id'));
      filters.push(`a.doctor_id = $${params.length}`);
    }
    const status = v.canonicalise(req.query.status, v.APPOINTMENT_STATUSES, 'status');
    if (status) {
      params.push(status);
      filters.push(`a.status = $${params.length}`);
    }
    if (req.query.start_date) {
      params.push(v.requireDate(req.query.start_date, 'start_date'));
      filters.push(`a.appointment_date >= $${params.length}::date`);
    }
    if (req.query.end_date) {
      // Inclusive of the whole end day, since appointment_date carries a time.
      params.push(v.requireDate(req.query.end_date, 'end_date'));
      filters.push(`a.appointment_date < ($${params.length}::date + INTERVAL '1 day')`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const rows = await pool.query(
      `${SELECT_APPOINTMENT} ${where}
        ORDER BY a.appointment_date DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const count = await pool.query(
      `SELECT COUNT(*)::int AS total FROM appointments a ${where}`,
      params
    );

    return res.json({
      data: rows.rows,
      pagination: { page, limit, total: count.rows[0].total },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/appointments
 *
 * doctor_id is NOT NULL in the schema. A Physician booking their own clinic
 * defaults to themselves; Admin and Receptionist must name the doctor, since
 * their own user_id would be wrong.
 */
router.post(
  '/',
  requireRole(...WRITE_ROLES),
  audit('appointment', 'CREATE', (req, body) => body?.appointment_id ?? '-'),
  async (req, res, next) => {
    try {
      const b = req.body || {};
      const patientId = v.requireUuid(b.patient_id, 'patient_id');
      const appointmentDate = v.requireTimestamp(b.appointment_date, 'appointment_date');

      let doctorId = b.doctor_id;
      if (!doctorId && req.user.role === 'Physician') doctorId = req.user.userId;
      if (!doctorId) {
        throw new v.ValidationError(
          'doctor_id is required unless the requesting user is a Physician booking for themselves'
        );
      }
      v.requireUuid(doctorId, 'doctor_id');

      const status = v.canonicalise(b.status, v.APPOINTMENT_STATUSES, 'status') || 'Scheduled';

      const { rows } = await pool.query(
        `INSERT INTO appointments
           (patient_id, doctor_id, appointment_date, status, appointment_type, notes)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING appointment_id, patient_id, doctor_id, appointment_date, status,
                   appointment_type, notes, reminder_sent, created_at, updated_at`,
        [
          patientId,
          doctorId,
          appointmentDate,
          status,
          v.optionalString(b.appointment_type, 'appointment_type', 50),
          v.optionalString(b.notes, 'notes'),
        ]
      );

      return res.status(201).json(rows[0]);
    } catch (err) {
      return next(err);
    }
  }
);

const APPOINTMENT_RETURNING = `
  appointment_id, patient_id, doctor_id, appointment_date, status,
  appointment_type, notes, reminder_sent, created_at, updated_at
`;

const UPDATE_HANDLERS = {
  appointment_date: (x) => v.requireTimestamp(x, 'appointment_date'),
  doctor_id: (x) => v.requireUuid(x, 'doctor_id'),
  status: (x) => v.canonicalise(x, v.APPOINTMENT_STATUSES, 'status'),
  appointment_type: (x) => v.optionalString(x, 'appointment_type', 50),
  notes: (x) => v.optionalString(x, 'notes'),
  reminder_sent: (x) => {
    if (typeof x !== 'boolean') throw new v.ValidationError('reminder_sent must be a boolean');
    return x;
  },
};

// Reception schedules and reschedules; only Admin may reassign the doctor.
const UPDATABLE_BY_ROLE = {
  Admin: Object.keys(UPDATE_HANDLERS),
  Physician: ['appointment_date', 'status', 'appointment_type', 'notes'],
  Nurse: ['status', 'appointment_type', 'notes', 'reminder_sent'],
  Receptionist: ['appointment_date', 'status', 'appointment_type', 'notes', 'reminder_sent'],
};

// A finished or cancelled visit is a historical fact. Reopening one would
// rewrite the record rather than correct it, so it needs a new appointment.
const CLOSED_STATUSES = ['Completed', 'Cancelled'];

/** PATCH /api/appointments/:id - reschedule, re-status, or annotate. */
router.patch('/:id', requireRole(...WRITE_ROLES), async (req, res, next) => {
  const id = v.isUuid(req.params.id) ? req.params.id : null;
  if (!id) return next(new v.ValidationError('appointment_id must be a UUID'));

  const client = await pool.connect();
  try {
    const { assignments, params, changes } = buildUpdate(req.body, UPDATE_HANDLERS, {
      allowed: UPDATABLE_BY_ROLE[req.user.role] || [],
    });

    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT ${APPOINTMENT_RETURNING} FROM appointments WHERE appointment_id = $1 FOR UPDATE`,
      [id]
    );
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const before = existing.rows[0];
    if (CLOSED_STATUSES.includes(before.status) && req.user.role !== 'Admin') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `A ${before.status.toLowerCase()} appointment cannot be modified`,
        hint: 'Create a new appointment instead',
      });
    }

    // appointments has an updated_at column but no trigger in schema.sql, so it
    // is set explicitly here.
    const updated = await client.query(
      `UPDATE appointments SET ${assignments.join(', ')}, updated_at = NOW()
        WHERE appointment_id = $${params.length + 1}
        RETURNING ${APPOINTMENT_RETURNING}`,
      [...params, id]
    );

    await client.query('COMMIT');

    const { oldValues, newValues, changed } = diff(before, changes);
    if (changed.length > 0) {
      await writeAudit({
        userId: req.user.userId,
        entityType: 'appointment',
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
 * DELETE /api/appointments/:id
 *
 * Cancels rather than deletes. A cancellation and a booking that never existed
 * are clinically different: no-shows and late cancellations are exactly the
 * pattern the appointments table exists to show. ?purge=true, Admin only, is
 * available for a genuine mis-entry.
 */
router.delete('/:id', requireRole('Admin', 'Receptionist', 'Physician'), async (req, res, next) => {
  const id = v.isUuid(req.params.id) ? req.params.id : null;
  if (!id) return next(new v.ValidationError('appointment_id must be a UUID'));

  const purge = req.query.purge === 'true';
  if (purge && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Only an Admin may purge an appointment' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT ${APPOINTMENT_RETURNING} FROM appointments WHERE appointment_id = $1 FOR UPDATE`,
      [id]
    );
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Appointment not found' });
    }
    const before = existing.rows[0];

    if (purge) {
      await client.query(
        `INSERT INTO audit_logs
           (user_id, entity_type, entity_id, action, old_values, new_values, ip_address)
         VALUES ($1, 'appointment', $2, 'DELETE', $3, $4, $5)`,
        [
          req.user.userId, id, JSON.stringify(before),
          JSON.stringify({ deleted: 'purge' }), req.ip || null,
        ]
      );
      await client.query('DELETE FROM appointments WHERE appointment_id = $1', [id]);
      await client.query('COMMIT');
      return res.json({ appointment_id: id, deleted: 'purge' });
    }

    if (before.status === 'Cancelled') {
      await client.query('ROLLBACK');
      return res.json({ ...before, deleted: 'soft', already_cancelled: true });
    }
    if (before.status === 'Completed') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'A completed appointment cannot be cancelled',
        hint: 'Purge it as an Admin if it was recorded in error',
      });
    }

    const updated = await client.query(
      `UPDATE appointments SET status = 'Cancelled', updated_at = NOW()
        WHERE appointment_id = $1 RETURNING ${APPOINTMENT_RETURNING}`,
      [id]
    );
    await client.query('COMMIT');

    await writeAudit({
      userId: req.user.userId,
      entityType: 'appointment',
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
