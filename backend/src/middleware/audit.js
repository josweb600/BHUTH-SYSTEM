const { pool } = require('../db');

/**
 * Append an entry to audit_logs. Patient data access has to be traceable, so
 * this is called on reads as well as writes. Failures are logged but never
 * block the request.
 */
async function writeAudit({ userId, entityType, entityId, action, oldValues, newValues, ip }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs
         (user_id, entity_type, entity_id, action, old_values, new_values, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId || null,
        entityType,
        String(entityId),
        action,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ip || null,
      ]
    );
  } catch (err) {
    console.error('audit_logs write failed:', err.message);
  }
}

/** Express helper: audit after a successful response. */
function audit(entityType, action, entityIdFrom = (req, body) => body?.patient_id ?? req.params.id ?? '-') {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 400) {
        writeAudit({
          userId: req.user?.userId,
          entityType,
          entityId: entityIdFrom(req, body),
          action,
          newValues: action === 'READ' ? null : body,
          ip: req.ip,
        });
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = { writeAudit, audit };
