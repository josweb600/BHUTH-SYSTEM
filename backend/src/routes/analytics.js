const express = require('express');

const { pool } = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/analytics/dashboard
 *
 * Every status literal here is capitalised to match the CHECK constraints in
 * database/schema.sql. The previous lowercase versions matched nothing, so the
 * appointment and revenue figures were always zero.
 *
 * Revenue counts paid_amount rather than total_amount, so a bill that is issued
 * but unpaid is not reported as money received.
 */
router.get('/dashboard', requireRole('Admin', 'Accountant'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM patients WHERE status = 'Active') AS active_patients,
        (SELECT COUNT(*)::int FROM patients) AS total_patients,
        (SELECT COUNT(*)::int FROM appointments
          WHERE status = 'Scheduled'
            AND appointment_date >= CURRENT_DATE
            AND appointment_date < CURRENT_DATE + INTERVAL '1 day') AS appointments_today,
        (SELECT COUNT(*)::int FROM appointments
          WHERE status = 'Scheduled' AND appointment_date >= NOW()) AS appointments_upcoming,
        (SELECT COUNT(*)::int FROM lab_tests
          WHERE status IN ('Pending', 'In_Progress')) AS lab_tests_open,
        (SELECT COUNT(*)::int FROM lab_tests
          WHERE status = 'Pending' AND priority = 'Urgent') AS lab_tests_urgent,
        (SELECT COALESCE(SUM(paid_amount), 0) FROM bills
          WHERE status IN ('Paid', 'Partial')
            AND bill_date >= date_trunc('month', CURRENT_DATE)) AS revenue_this_month,
        (SELECT COALESCE(SUM(patient_responsibility - paid_amount), 0) FROM bills
          WHERE status IN ('Pending', 'Partial')) AS outstanding_balance,
        (SELECT COUNT(*)::int FROM bills
          WHERE status IN ('Pending', 'Partial')
            AND due_date IS NOT NULL AND due_date < CURRENT_DATE) AS bills_overdue
    `);

    return res.json({ generated_at: new Date().toISOString(), ...rows[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
