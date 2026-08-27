const express = require('express');

const { pool } = require('../db');
const { requireRole } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const v = require('../validators');

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

module.exports = router;
