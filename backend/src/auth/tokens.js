const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
const REFRESH_TTL = process.env.JWT_REFRESH_TTL || '7d';
const ISSUER = 'bhuth-ehms';

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value === 'CHANGE_ME' || value.length < 32) {
    throw new Error('JWT_SECRET must be set to a random value of at least 32 characters');
  }
  return value;
}

/**
 * Every token carries a random jti.
 *
 * Without it, two tokens signed for the same user in the same second are byte
 * identical, because iat has one-second resolution. Rotation would then hand
 * back the token it was supposed to replace, and a stolen refresh token used
 * within that second would survive the rotation meant to invalidate it.
 */
function jti() {
  return crypto.randomUUID();
}

function signAccessToken({ userId, role, employeeId }) {
  return jwt.sign(
    { sub: userId, role, employee_id: employeeId, typ: 'access', jti: jti() },
    secret(),
    { expiresIn: ACCESS_TTL, issuer: ISSUER }
  );
}

function signRefreshToken({ userId }) {
  return jwt.sign({ sub: userId, typ: 'refresh', jti: jti() }, secret(), {
    expiresIn: REFRESH_TTL,
    issuer: ISSUER,
  });
}

/** Verify a token and assert its type. Throws on invalid, expired or wrong-type tokens. */
function verifyToken(token, expectedType) {
  const payload = jwt.verify(token, secret(), { issuer: ISSUER });
  if (payload.typ !== expectedType) {
    throw new Error(`Expected a ${expectedType} token`);
  }
  return payload;
}

/**
 * Tokens are stored in user_sessions as SHA-256 hashes, never in plaintext.
 * A stolen database dump then cannot be replayed against the API.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function refreshExpiryDate() {
  const match = /^(\d+)([smhd])$/.exec(REFRESH_TTL);
  const units = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 };
  const ms = match ? Number(match[1]) * units[match[2]] : 7 * 864e5;
  return new Date(Date.now() + ms);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  hashToken,
  refreshExpiryDate,
  ACCESS_TTL,
  REFRESH_TTL,
};
