const express = require('express');

const { pool } = require('../db');
const { requireRole } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const v = require('../validators');

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

module.exports = router;
