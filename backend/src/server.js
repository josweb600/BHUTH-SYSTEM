// backend/src/server.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { pool } = require('./db');
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const appointmentRoutes = require('./routes/appointments');
const labTestRoutes = require('./routes/labTests');
const billRoutes = require('./routes/bills');
const analyticsRoutes = require('./routes/analytics');
const { ValidationError } = require('./validators');
const { requireAuth } = require('./middleware/auth');

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

// ====================
// DATA ENDPOINTS
// ====================
//
// Each router owns its own validation and role checks. Column names and status
// literals match database/schema.sql exactly - see issue #3 for the mismatch
// these replace.

app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/lab-tests', labTestRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/analytics', analyticsRoutes);

// ====================
// ERROR HANDLING
// ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler. Never leak stack traces or driver messages to clients.
app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message, ...(err.details && { details: err.details }) });
  }

  if (err.message && err.message.startsWith('Origin ')) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  // Malformed JSON body from express.json()
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }

  // Translate the constraint violations the schema can raise into 4xx, so a bad
  // request is not reported to the client as a server fault. The constraint name
  // is safe to echo; err.message can contain row data and is only logged.
  switch (err.code) {
    case '23502': // not_null_violation
      console.error(err.stack || err.message);
      return res.status(400).json({ error: `${err.column} is required` });
    case '23503': // foreign_key_violation
      console.error(err.stack || err.message);
      return res.status(400).json({ error: 'Referenced record does not exist', constraint: err.constraint });
    case '23505': // unique_violation
      console.error(err.stack || err.message);
      return res.status(409).json({ error: 'Record already exists', constraint: err.constraint });
    case '23514': // check_violation
      console.error(err.stack || err.message);
      return res.status(400).json({ error: 'Value not allowed by constraint', constraint: err.constraint });
    case '22P02': // invalid_text_representation, e.g. a malformed UUID
    case '22007': // invalid_datetime_format
      console.error(err.stack || err.message);
      return res.status(400).json({ error: 'Malformed value in request' });
    default:
      console.error(err.stack || err.message);
      return res.status(500).json({ error: 'Internal server error' });
  }
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
