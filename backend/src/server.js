// backend/src/server.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { pool } = require('./db');
const authRoutes = require('./routes/auth');
const { requireAuth, requireRole } = require('./middleware/auth');
const { audit } = require('./middleware/audit');

const app = express();

// Behind nginx: needed for req.ip to be the real client address, which the
// login rate limiter and audit_logs both depend on.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));

// Middleware
app.use(helmet()); // Security headers

// CORS: allowlist only. A wildcard would let any origin drive the API with a
// user's token.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) =>
      !origin || allowedOrigins.includes(origin)
        ? cb(null, true)
        : cb(new Error(`Origin ${origin} not allowed`)),
    credentials: true,
  })
);

app.use(morgan('combined')); // Logging
app.use(express.json({ limit: '1mb' })); // JSON parser

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'OK',
      database: 'connected',
      timestamp: result.rows[0].now
    });
  } catch (err) {
    res.status(500).json({
      status: 'ERROR',
      database: 'disconnected',
      error: err.message
    });
  }
});

// ====================
// AUTHENTICATION
// ====================

// Public: login, refresh. Authenticated: logout, me.
app.use('/api/auth', authRoutes);

// Everything mounted below this line requires a valid access token.
// /api/health and /api/auth are declared above and stay public.
app.use('/api', requireAuth);

const CLINICAL = ['Admin', 'Physician', 'Nurse'];

// ====================
// PATIENT ENDPOINTS
// ====================

// GET all patients
app.get('/api/patients', requireRole(...CLINICAL, 'Receptionist', 'Lab_Technician', 'Radiologist', 'Accountant'), audit('patient', 'READ', () => 'list'), async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const query = `
      SELECT id, mrn, first_name, last_name, date_of_birth, gender, 
             contact_number, email, address, insurance_id, created_at
      FROM patients
      WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR mrn = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
    
    const result = await pool.query(query, [
      `%${search}%`,
      search,
      limit,
      offset
    ]);
    
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM patients WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR mrn = $2',
      [`%${search}%`, search]
    );
    
    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET patient by ID
app.get('/api/patients/:id', requireRole(...CLINICAL, 'Receptionist', 'Lab_Technician', 'Radiologist', 'Accountant'), audit('patient', 'READ', (req) => req.params.id), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM patients WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE patient
app.post('/api/patients', requireRole('Admin', 'Receptionist', 'Physician', 'Nurse'), audit('patient', 'CREATE', (req, body) => body?.patient_id ?? '-'), async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      mrn, first_name, last_name, date_of_birth, gender,
      contact_number, email, address, insurance_id
    } = req.body;
    
    // Validation
    if (!mrn || !first_name || !last_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const query = `
      INSERT INTO patients 
      (mrn, first_name, last_name, date_of_birth, gender, contact_number, email, address, insurance_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *
    `;
    
    const result = await client.query(query, [
      mrn, first_name, last_name, date_of_birth, gender,
      contact_number, email, address, insurance_id
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ====================
// APPOINTMENT ENDPOINTS
// ====================

// GET all appointments
app.get('/api/appointments', requireRole(...CLINICAL, 'Receptionist'), async (req, res) => {
  try {
    const { patient_id, status, start_date, end_date } = req.query;
    
    let query = `
      SELECT a.id, a.patient_id, a.appointment_date, a.appointment_time,
             a.status, a.reason, a.notes, p.first_name, p.last_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (patient_id) {
      query += ` AND a.patient_id = $${paramIndex}`;
      params.push(patient_id);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND a.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (start_date) {
      query += ` AND a.appointment_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND a.appointment_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    
    query += ' ORDER BY a.appointment_date DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE appointment
app.post('/api/appointments', requireRole('Admin', 'Receptionist', 'Physician', 'Nurse'), audit('appointment', 'CREATE'), async (req, res) => {
  try {
    const { patient_id, appointment_date, appointment_time, reason, notes } = req.body;
    
    if (!patient_id || !appointment_date || !appointment_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const query = `
      INSERT INTO appointments 
      (patient_id, appointment_date, appointment_time, status, reason, notes, created_at)
      VALUES ($1, $2, $3, 'scheduled', $4, $5, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      patient_id, appointment_date, appointment_time, reason, notes
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================
// LAB TEST ENDPOINTS
// ====================

// GET lab tests
app.get('/api/lab-tests', requireRole(...CLINICAL, 'Lab_Technician'), async (req, res) => {
  try {
    const { patient_id, status } = req.query;
    
    let query = 'SELECT * FROM lab_tests WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (patient_id) {
      query += ` AND patient_id = $${paramIndex}`;
      params.push(patient_id);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE lab test
app.post('/api/lab-tests', requireRole('Admin', 'Physician', 'Nurse'), audit('lab_test', 'CREATE'), async (req, res) => {
  try {
    const { patient_id, test_name, notes } = req.body;
    
    if (!patient_id || !test_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const query = `
      INSERT INTO lab_tests 
      (patient_id, test_name, status, notes, created_at)
      VALUES ($1, $2, 'pending', $3, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [patient_id, test_name, notes]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================
// BILLING ENDPOINTS
// ====================

// GET bills
app.get('/api/bills', requireRole('Admin', 'Accountant', 'Receptionist'), async (req, res) => {
  try {
    const { patient_id, status } = req.query;
    
    let query = 'SELECT * FROM bills WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (patient_id) {
      query += ` AND patient_id = $${paramIndex}`;
      params.push(patient_id);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE bill
app.post('/api/bills', requireRole('Admin', 'Accountant'), audit('bill', 'CREATE'), async (req, res) => {
  try {
    const { patient_id, total_amount, description } = req.body;
    
    if (!patient_id || !total_amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const query = `
      INSERT INTO bills 
      (patient_id, total_amount, status, description, created_at)
      VALUES ($1, $2, 'pending', $3, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [patient_id, total_amount, description]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================
// ANALYTICS ENDPOINTS
// ====================

// GET dashboard statistics
app.get('/api/analytics/dashboard', requireRole('Admin', 'Accountant'), async (req, res) => {
  try {
    const stats = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM patients'),
      pool.query("SELECT COUNT(*) as total FROM appointments WHERE status = 'scheduled'"),
      pool.query("SELECT COUNT(*) as total FROM lab_tests WHERE status = 'pending'"),
      pool.query("SELECT COUNT(*) as total FROM bills WHERE status = 'pending'"),
      pool.query('SELECT COALESCE(SUM(total_amount), 0) as revenue FROM bills WHERE status = \'paid\'')
    ]);
    
    res.json({
      totalPatients: stats[0].rows[0].total,
      todayAppointments: stats[1].rows[0].total,
      pendingLabTests: stats[2].rows[0].total,
      outstandingBills: stats[3].rows[0].total,
      totalRevenue: stats[4].rows[0].revenue
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================
// ERROR HANDLING
// ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler. Never leak stack traces or driver messages to clients.
app.use((err, req, res, next) => {
  console.error(err.stack || err.message);
  if (err.message && err.message.startsWith('Origin ')) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  return res.status(500).json({ error: 'Internal server error' });
});

// ====================
// START SERVER
// ====================

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`🏥 Hospital EHMS API running on port ${PORT}`);
  console.log(`Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    pool.end();
    process.exit(0);
  });
});

module.exports = app;
