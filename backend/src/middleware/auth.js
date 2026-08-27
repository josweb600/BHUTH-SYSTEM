const { pool } = require('../db');
const { verifyToken, hashToken } = require('../auth/tokens');

/**
 * Require a valid, unexpired access token whose session row still exists.
 * Revoking a session (logout) therefore takes effect immediately, which a
 * stateless JWT check alone would not give us.
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  let payload;
  try {
    payload = verifyToken(token, 'access');
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({ error: expired ? 'Token expired' : 'Invalid token' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT s.session_id, u.user_id, u.role, u.employee_id, u.is_active
         FROM user_sessions s
         JOIN users u ON u.user_id = s.user_id
        WHERE s.access_token = $1 AND s.expires_at > NOW()`,
      [hashToken(token)]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Session revoked or expired' });
    }
    if (!rows[0].is_active) {
      return res.status(403).json({ error: 'Account disabled' });
    }

    req.user = {
      userId: rows[0].user_id,
      role: rows[0].role,
      employeeId: rows[0].employee_id,
      sessionId: rows[0].session_id,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Restrict a route to specific users.role values. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        actual: req.user.role,
      });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
