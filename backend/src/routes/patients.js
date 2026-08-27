const express = require('express');

const { pool } = require('../db');
const { requireRole } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const v = require('../validators');

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

module.exports = router;
