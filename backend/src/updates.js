/**
 * Helpers for partial updates.
 *
 * PATCH has to distinguish "field absent" from "field set to null", apply a
 * per-role allowlist of writable columns, and produce a before/after diff for
 * audit_logs. Doing that inline in each route invited inconsistency, so it lives
 * here.
 */

const { ValidationError } = require('./validators');

/**
 * Build the SET clause for an UPDATE from a request body.
 *
 * @param {object} body     the request body
 * @param {object} handlers map of column name -> (value) => coerced value
 * @param {object} options  { allowed: string[] } columns this caller may write
 * @returns {{ assignments: string[], params: any[], changes: object }}
 *
 * A key that is present but not permitted is rejected rather than ignored: a
 * client that tries to change a field it cannot write should be told, not
 * silently given a 200 that did nothing.
 */
function buildUpdate(body, handlers, { allowed, startIndex = 1 } = {}) {
  const source = body && typeof body === 'object' ? body : {};
  const keys = Object.keys(source);

  if (keys.length === 0) {
    throw new ValidationError('Request body must contain at least one field to update');
  }

  const known = Object.keys(handlers);
  const unknown = keys.filter((k) => !known.includes(k));
  if (unknown.length > 0) {
    throw new ValidationError('Unknown or immutable field', {
      fields: unknown,
      updatable: known,
    });
  }

  if (allowed) {
    const forbidden = keys.filter((k) => !allowed.includes(k));
    if (forbidden.length > 0) {
      throw new ValidationError('Your role may not change these fields', {
        fields: forbidden,
        allowed_for_your_role: allowed,
      });
    }
  }

  const assignments = [];
  const params = [];
  const changes = {};

  for (const key of keys) {
    const value = handlers[key](source[key]);
    params.push(value);
    assignments.push(`${key} = $${startIndex + params.length - 1}`);
    changes[key] = value;
  }

  return { assignments, params, changes };
}

/**
 * Reduce a before/after pair to only the columns that actually changed, so
 * audit_logs records the edit rather than a copy of the whole row twice.
 * Comparison has to be loose in two specific ways, because the pg driver does not
 * hand back what was sent: NUMERIC arrives as a string ('250.00' for 250), and
 * timestamps arrive as Date objects. Everything else is compared strictly, so a
 * genuine type change is still recorded.
 */
function sameValue(a, b) {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (a instanceof Date || b instanceof Date) {
    const ta = new Date(a).getTime();
    const tb = new Date(b).getTime();
    return Number.isFinite(ta) && ta === tb;
  }
  // NUMERIC: '250.00' and 250 are the same amount. Compared as numbers rather
  // than strings, which would see '250.00' !== '250'.
  const na = typeof a === 'number' ? a : Number(a);
  const nb = typeof b === 'number' ? b : Number(b);
  if (
    Number.isFinite(na) && Number.isFinite(nb)
    && a !== '' && b !== '' && typeof a !== 'boolean' && typeof b !== 'boolean'
  ) {
    return na === nb;
  }
  return String(a) === String(b);
}

function diff(before, after) {
  const oldValues = {};
  const newValues = {};

  for (const key of Object.keys(after)) {
    if (!(key in before)) continue;
    const a = before[key];
    const b = after[key];
    if (!sameValue(a, b)) {
      oldValues[key] = a instanceof Date ? a.toISOString() : a;
      newValues[key] = b instanceof Date ? b.toISOString() : b;
    }
  }

  return { oldValues, newValues, changed: Object.keys(newValues) };
}

module.exports = { buildUpdate, diff };
