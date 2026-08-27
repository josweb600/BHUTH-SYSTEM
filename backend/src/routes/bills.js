const express = require('express');

const { pool } = require('../db');
const { requireRole } = require('../middleware/auth');
const { audit, writeAudit } = require('../middleware/audit');
const v = require('../validators');
const { buildUpdate, diff } = require('../updates');

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

const BILL_RETURNING = `
  bill_id, bill_number, patient_id, bill_date, service_date, total_amount,
  discount_amount, insurance_amount, patient_responsibility, paid_amount,
  status, due_date, created_by, created_at, updated_at
`;

// bill_number is left out on purpose: it is the reference printed on the
// patient's copy and quoted on payment. patient_responsibility is derived, so it
// is not accepted either.
const UPDATE_HANDLERS = {
  service_date: (x) => v.optionalDate(x, 'service_date'),
  due_date: (x) => v.optionalDate(x, 'due_date'),
  total_amount: (x) => v.money(x, 'total_amount'),
  discount_amount: (x) => v.money(x, 'discount_amount'),
  insurance_amount: (x) => v.money(x, 'insurance_amount'),
  paid_amount: (x) => v.money(x, 'paid_amount'),
  status: (x) => v.canonicalise(x, v.BILL_STATUSES, 'status'),
};

const UPDATABLE_BY_ROLE = {
  Admin: Object.keys(UPDATE_HANDLERS),
  Accountant: Object.keys(UPDATE_HANDLERS),
};

const MONEY_FIELDS = ['total_amount', 'discount_amount', 'insurance_amount', 'paid_amount'];

/**
 * PATCH /api/bills/:id
 *
 * Any change to the money fields re-derives patient_responsibility and, unless
 * the caller states a status explicitly, the status too. Letting a client send
 * those directly is how a bill ends up marked Paid while still showing a
 * balance.
 */
router.patch('/:id', requireRole('Admin', 'Accountant'), async (req, res, next) => {
  const id = v.isUuid(req.params.id) ? req.params.id : null;
  if (!id) return next(new v.ValidationError('bill_id must be a UUID'));

  const client = await pool.connect();
  try {
    const { changes } = buildUpdate(req.body, UPDATE_HANDLERS, {
      allowed: UPDATABLE_BY_ROLE[req.user.role] || [],
    });

    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT ${BILL_RETURNING} FROM bills WHERE bill_id = $1 FOR UPDATE`,
      [id]
    );
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bill not found' });
    }
    const before = existing.rows[0];

    if (before.status === 'Cancelled') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'A cancelled bill cannot be edited',
        hint: 'Issue a new bill instead',
      });
    }

    // Merge requested amounts over the stored ones. NUMERIC comes back from the
    // driver as a string, so the stored values are parsed before arithmetic.
    const amounts = {};
    for (const field of MONEY_FIELDS) {
      amounts[field] = field in changes ? changes[field] : Number(before[field]);
    }

    const owed = v.patientResponsibility({
      total: amounts.total_amount,
      discount: amounts.discount_amount,
      insurance: amounts.insurance_amount,
    });

    if (amounts.paid_amount > owed) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'paid_amount cannot exceed patient_responsibility',
        paid_amount: amounts.paid_amount,
        patient_responsibility: owed,
      });
    }

    const touchedMoney = MONEY_FIELDS.some((f) => f in changes);
    let status = 'status' in changes ? changes.status : before.status;
    if (touchedMoney && !('status' in changes) && before.status !== 'Cancelled') {
      if (amounts.paid_amount === 0) status = 'Pending';
      else if (amounts.paid_amount < owed) status = 'Partial';
      else status = 'Paid';
    }

    const final = {
      service_date: 'service_date' in changes ? changes.service_date : before.service_date,
      due_date: 'due_date' in changes ? changes.due_date : before.due_date,
      ...amounts,
      patient_responsibility: owed,
      status,
    };

    const updated = await client.query(
      `UPDATE bills SET
         service_date = $1, due_date = $2, total_amount = $3, discount_amount = $4,
         insurance_amount = $5, paid_amount = $6, patient_responsibility = $7,
         status = $8, updated_at = NOW()
       WHERE bill_id = $9
       RETURNING ${BILL_RETURNING}`,
      [
        final.service_date, final.due_date, final.total_amount, final.discount_amount,
        final.insurance_amount, final.paid_amount, final.patient_responsibility,
        final.status, id,
      ]
    );

    await client.query('COMMIT');

    const { oldValues, newValues, changed } = diff(before, final);
    if (changed.length > 0) {
      await writeAudit({
        userId: req.user.userId,
        entityType: 'bill',
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
 * DELETE /api/bills/:id
 *
 * Cancels the bill. Deleting a financial document leaves a gap in the
 * bill_number sequence, which is exactly what an auditor looks for, so the row
 * stays and the status changes. Cancellation is refused once money has been
 * received - that needs a refund or a credit note, neither of which this API
 * has. ?purge=true is Admin only and refused on the same grounds.
 */
router.delete('/:id', requireRole('Admin', 'Accountant'), async (req, res, next) => {
  const id = v.isUuid(req.params.id) ? req.params.id : null;
  if (!id) return next(new v.ValidationError('bill_id must be a UUID'));

  const purge = req.query.purge === 'true';
  if (purge && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Only an Admin may purge a bill' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT ${BILL_RETURNING} FROM bills WHERE bill_id = $1 FOR UPDATE`,
      [id]
    );
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bill not found' });
    }
    const before = existing.rows[0];

    if (Number(before.paid_amount) > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'A bill with payments against it cannot be cancelled or purged',
        paid_amount: before.paid_amount,
        hint: 'Record a refund or issue a credit note first',
      });
    }

    if (purge) {
      if (before.bill_number) {
        await client.query(
          `INSERT INTO audit_logs
             (user_id, entity_type, entity_id, action, old_values, new_values, ip_address)
           VALUES ($1, 'bill', $2, 'DELETE', $3, $4, $5)`,
          [
            req.user.userId, id, JSON.stringify(before),
            JSON.stringify({ deleted: 'purge', bill_number: before.bill_number }),
            req.ip || null,
          ]
        );
      }
      await client.query('DELETE FROM bills WHERE bill_id = $1', [id]);
      await client.query('COMMIT');
      return res.json({ bill_id: id, bill_number: before.bill_number, deleted: 'purge' });
    }

    if (before.status === 'Cancelled') {
      await client.query('ROLLBACK');
      return res.json({ ...before, deleted: 'soft', already_cancelled: true });
    }

    const updated = await client.query(
      `UPDATE bills SET status = 'Cancelled', updated_at = NOW()
        WHERE bill_id = $1 RETURNING ${BILL_RETURNING}`,
      [id]
    );
    await client.query('COMMIT');

    await writeAudit({
      userId: req.user.userId,
      entityType: 'bill',
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
