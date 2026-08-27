/**
 * Input validation for the data endpoints.
 *
 * The enumerations here mirror the CHECK constraints in database/schema.sql
 * exactly. Validating in the API means a bad value returns a 400 with a useful
 * message instead of a Postgres constraint violation surfacing as a 500.
 */

const GENDERS = ['M', 'F', 'Other'];
const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const PATIENT_STATUSES = ['Active', 'Inactive', 'Deceased'];
const APPOINTMENT_STATUSES = ['Scheduled', 'Completed', 'Cancelled', 'No_Show', 'Rescheduled'];
const LAB_STATUSES = ['Pending', 'In_Progress', 'Completed', 'Cancelled'];
const LAB_PRIORITIES = ['Routine', 'Normal', 'Urgent'];
const BILL_STATUSES = ['Pending', 'Partial', 'Paid', 'Cancelled'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.details = details;
  }
}

/** True for a syntactically valid UUID. Rejects it before it reaches Postgres. */
function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function requireUuid(value, field) {
  if (!isUuid(value)) throw new ValidationError(`${field} must be a UUID`);
  return value;
}

/**
 * Match a client-supplied status against a CHECK constraint, case-insensitively,
 * and return the canonical capitalisation the database expects. Callers were
 * previously sending 'pending' where the constraint requires 'Pending'.
 */
function canonicalise(value, allowed, field) {
  if (value === undefined || value === null || value === '') return undefined;
  const match = allowed.find((a) => a.toLowerCase() === String(value).toLowerCase());
  if (!match) {
    throw new ValidationError(`Invalid ${field}`, { allowed, received: value });
  }
  return match;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

/**
 * Clamp pagination so a client cannot request an unbounded result set.
 * Anything unparseable or below 1 falls back to the default rather than being
 * clamped, so `limit=0` and `limit=-5` behave the same as omitting it.
 */
function pagination(query = {}) {
  const parsePositive = (value, fallback) => {
    const num = Number.parseInt(value, 10);
    return Number.isInteger(num) && num >= 1 ? num : fallback;
  };
  const page = parsePositive(query.page, 1);
  const limit = Math.min(MAX_LIMIT, parsePositive(query.limit, DEFAULT_LIMIT));
  return { page, limit, offset: (page - 1) * limit };
}

function requireDate(value, field) {
  if (!DATE_RE.test(String(value || ''))) {
    throw new ValidationError(`${field} must be a date in YYYY-MM-DD format`);
  }
  return value;
}

function optionalDate(value, field) {
  return value === undefined || value === null || value === '' ? null : requireDate(value, field);
}

function requireTimestamp(value, field) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new ValidationError(`${field} must be a valid ISO 8601 timestamp`);
  }
  return date.toISOString();
}

/** Non-negative money value with at most two decimal places. */
function money(value, field, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ValidationError(`${field} is required`);
    return 0;
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new ValidationError(`${field} must be a non-negative number`);
  }
  if (num > 99999999.99) {
    throw new ValidationError(`${field} exceeds NUMERIC(10,2)`);
  }
  return Math.round(num * 100) / 100;
}

function requireString(value, field, max) {
  const str = typeof value === 'string' ? value.trim() : '';
  if (!str) throw new ValidationError(`${field} is required`);
  if (max && str.length > max) {
    throw new ValidationError(`${field} must be at most ${max} characters`);
  }
  return str;
}

function optionalString(value, field, max) {
  if (value === undefined || value === null || value === '') return null;
  const str = String(value).trim();
  if (max && str.length > max) {
    throw new ValidationError(`${field} must be at most ${max} characters`);
  }
  return str || null;
}

/**
 * patient_responsibility is NOT NULL in the schema and must not be supplied by
 * the client - it is derived so a caller cannot understate what a patient owes.
 */
function patientResponsibility({ total, discount, insurance }) {
  const owed = total - discount - insurance;
  if (owed < 0) {
    throw new ValidationError(
      'discount_amount plus insurance_amount cannot exceed total_amount',
      { total_amount: total, discount_amount: discount, insurance_amount: insurance }
    );
  }
  return Math.round(owed * 100) / 100;
}

module.exports = {
  ValidationError,
  GENDERS,
  BLOOD_TYPES,
  PATIENT_STATUSES,
  APPOINTMENT_STATUSES,
  LAB_STATUSES,
  LAB_PRIORITIES,
  BILL_STATUSES,
  isUuid,
  requireUuid,
  canonicalise,
  pagination,
  requireDate,
  optionalDate,
  requireTimestamp,
  money,
  requireString,
  optionalString,
  patientResponsibility,
};
