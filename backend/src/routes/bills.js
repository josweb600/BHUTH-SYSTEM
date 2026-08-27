const express = require('express');

const { pool } = require('../db');
const { requireRole } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const v = require('../validators');

const router = express.Router();

const SELECT_BILL = `
  SELECT b.bill_id, b.bill_number, b.patient_id, b.bill_date, b.service_date,
         b.total_amount, b.discount_amount, b.insurance_amount,
         b.patient_responsibility, b.paid_amount, b.status, b.due_date,
         b.created_by, b.created_at, b.updated_at,
         p.first_name AS patient_first_name, p.last_name AS patient_last_name, p.mrn
    FROM bills b
    JOIN patients p ON p.patient_id = b.patient_id
`;

/**
 * bill_number is UNIQUE NOT NULL with no default. Generated as
 * BHUTH-YYYYMMDD-NNNN from a daily count, retried on the unique violation that
 * two concurrent inserts would cause.
 */
async function nextBillNumber(client, billDate) {
  const stamp = String(billDate).replace(/-/g, '');
  const { rows } = await client.query(
    'SELECT COUNT(*)::int AS used FROM bills WHERE bill_date = $1::date',
    [billDate]
  );
  return `BHUTH-${stamp}-${String(rows[0].used + 1).padStart(4, '0')}`;
}

/**
 * GET /api/bills
 * Query: page, limit, patient_id, status
 */
router.get('/', requireRole('Admin', 'Accountant', 'Receptionist'), async (req, res, next) => {
  try {
    const { page, limit, offset } = v.pagination(req.query);
    const filters = [];
    const params = [];

    if (req.query.patient_id) {
      params.push(v.requireUuid(req.query.patient_id, 'patient_id'));
      filters.push(`b.patient_id = $${params.length}`);
    }
    const status = v.canonicalise(req.query.status, v.BILL_STATUSES, 'status');
    if (status) {
      params.push(status);
      filters.push(`b.status = $${params.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const rows = await pool.query(
      `${SELECT_BILL} ${where}
        ORDER BY b.bill_date DESC, b.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM bills b ${where}`, params);

    return res.json({
      data: rows.rows,
      pagination: { page, limit, total: count.rows[0].total },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/bills
 *
 * patient_responsibility is derived, never accepted from the client. created_by
 * comes from the authenticated user.
 */
router.post(
  '/',
  requireRole('Admin', 'Accountant'),
  audit('bill', 'CREATE', (req, body) => body?.bill_id ?? '-'),
  async (req, res, next) => {
    try {
      const b = req.body || {};
      const patientId = v.requireUuid(b.patient_id, 'patient_id');
      const billDate = b.bill_date
        ? v.requireDate(b.bill_date, 'bill_date')
        : new Date().toISOString().slice(0, 10);
      const total = v.money(b.total_amount, 'total_amount', { required: true });
      const discount = v.money(b.discount_amount, 'discount_amount');
      const insurance = v.money(b.insurance_amount, 'insurance_amount');
      const paid = v.money(b.paid_amount, 'paid_amount');
      const owed = v.patientResponsibility({ total, discount, insurance });

      if (paid > owed) {
        throw new v.ValidationError('paid_amount cannot exceed patient_responsibility', {
          paid_amount: paid,
          patient_responsibility: owed,
        });
      }

      // Derive status from the amounts unless explicitly overridden.
      let status = v.canonicalise(b.status, v.BILL_STATUSES, 'status');
      if (!status) {
        if (paid === 0) status = 'Pending';
        else if (paid < owed) status = 'Partial';
        else status = 'Paid';
      }

      const client = await pool.connect();
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            await client.query('BEGIN');
            const billNumber = b.bill_number
              ? v.requireString(b.bill_number, 'bill_number', 50)
              : await nextBillNumber(client, billDate);

            const { rows } = await client.query(
              `INSERT INTO bills
                 (bill_number, patient_id, bill_date, service_date, total_amount,
                  discount_amount, insurance_amount, patient_responsibility,
                  paid_amount, status, due_date, created_by)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
               RETURNING bill_id, bill_number, patient_id, bill_date, service_date,
                         total_amount, discount_amount, insurance_amount,
                         patient_responsibility, paid_amount, status, due_date,
                         created_by, created_at, updated_at`,
              [
                billNumber,
                patientId,
                billDate,
                v.optionalDate(b.service_date, 'service_date'),
                total,
                discount,
                insurance,
                owed,
                paid,
                status,
                v.optionalDate(b.due_date, 'due_date'),
                req.user.userId,
              ]
            );
            await client.query('COMMIT');
            return res.status(201).json(rows[0]);
          } catch (err) {
            await client.query('ROLLBACK');
            // Another bill claimed this number first; recount and retry.
            if (err.code === '23505' && !b.bill_number && attempt < 2) continue;
            if (err.code === '23505') {
              return res.status(409).json({ error: 'bill_number already exists' });
            }
            throw err;
          }
        }
        return res.status(409).json({ error: 'Could not allocate a bill number, please retry' });
      } finally {
        client.release();
      }
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
