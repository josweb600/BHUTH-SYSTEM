const express = require('express');
const rateLimit = require('express-rate-limit');

const { pool } = require('../db');
const { verifyPassword } = require('../auth/passwords');
const {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  hashToken,
  refreshExpiryDate,
  ACCESS_TTL,
} = require('../auth/tokens');
const { requireAuth } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');

const router = express.Router();

// Brute-force protection: 10 login attempts per IP per 15 minutes.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, try again later' },
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns an access token, a refresh token and the user profile.
 */
router.post('/login', loginLimiter, async (req, res, next) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT user_id, employee_id, first_name, last_name, email, role,
              department, password_hash, is_active, mfa_enabled
         FROM users WHERE lower(email) = lower($1)`,
      [email]
    );

    const user = rows[0];
    const ok = await verifyPassword(password, user?.password_hash);

    // Identical response whether the email is unknown or the password is wrong.
    if (!user || !ok) {
      await writeAudit({
        userId: user?.user_id,
        entityType: 'auth',
        entityId: email,
        action: 'READ',
        newValues: { outcome: 'login_failed' },
        ip: req.ip,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account disabled' });
    }

    const accessToken = signAccessToken({
      userId: user.user_id,
      role: user.role,
      employeeId: user.employee_id,
    });
    const refreshToken = signRefreshToken({ userId: user.user_id });

    await pool.query(
      `INSERT INTO user_sessions
         (user_id, access_token, refresh_token, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        user.user_id,
        hashToken(accessToken),
        hashToken(refreshToken),
        req.ip,
        req.headers['user-agent'] || null,
        refreshExpiryDate(),
      ]
    );

    await pool.query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [user.user_id]);

    await writeAudit({
      userId: user.user_id,
      entityType: 'auth',
      entityId: user.user_id,
      action: 'READ',
      newValues: { outcome: 'login_success' },
      ip: req.ip,
    });

    return res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TTL,
      // NOTE: users.mfa_enabled defaults to true but no second factor is
      // implemented yet - see the open item in the pull request description.
      mfa_required: false,
      user: {
        user_id: user.user_id,
        employee_id: user.employee_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/auth/refresh
 * Body: { refresh_token }
 * Rotates both tokens: the old session row is replaced, so a stolen refresh
 * token stops working as soon as the real user refreshes.
 */
router.post('/refresh', async (req, res, next) => {
  const { refresh_token: refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({ error: 'refresh_token is required' });
  }

  let payload;
  try {
    payload = verifyToken(refreshToken, 'refresh');
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT s.session_id, u.user_id, u.role, u.employee_id, u.is_active
         FROM user_sessions s
         JOIN users u ON u.user_id = s.user_id
        WHERE s.refresh_token = $1 AND s.expires_at > NOW()
        FOR UPDATE`,
      [hashToken(refreshToken)]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Session not found or expired' });
    }
    if (!rows[0].is_active) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Account disabled' });
    }

    const user = rows[0];
    const newAccess = signAccessToken({
      userId: user.user_id,
      role: user.role,
      employeeId: user.employee_id,
    });
    const newRefresh = signRefreshToken({ userId: user.user_id });

    await client.query(
      `UPDATE user_sessions
          SET access_token = $1, refresh_token = $2, expires_at = $3
        WHERE session_id = $4`,
      [hashToken(newAccess), hashToken(newRefresh), refreshExpiryDate(), user.session_id]
    );

    await client.query('COMMIT');

    return res.json({
      access_token: newAccess,
      refresh_token: newRefresh,
      token_type: 'Bearer',
      expires_in: ACCESS_TTL,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return next(err);
  } finally {
    client.release();
  }
});

/** POST /api/auth/logout - revokes the current session immediately. */
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM user_sessions WHERE session_id = $1', [req.user.sessionId]);
    await writeAudit({
      userId: req.user.userId,
      entityType: 'auth',
      entityId: req.user.userId,
      action: 'DELETE',
      newValues: { outcome: 'logout' },
      ip: req.ip,
    });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

/** POST /api/auth/logout-all - revokes every session for the current user. */
router.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [
      req.user.userId,
    ]);
    return res.json({ sessions_revoked: result.rowCount });
  } catch (err) {
    return next(err);
  }
});

/** GET /api/auth/me - the authenticated user's profile. */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT user_id, employee_id, first_name, last_name, email, phone,
              role, department, last_login, created_at
         FROM users WHERE user_id = $1`,
      [req.user.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
