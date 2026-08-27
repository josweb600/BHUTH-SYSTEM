const bcrypt = require('bcryptjs');

const ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

/** Hash a plaintext password for storage in users.password_hash. */
async function hashPassword(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length < 12) {
    throw new Error('Password must be at least 12 characters');
  }
  return bcrypt.hash(plaintext, ROUNDS);
}

/**
 * Compare a candidate password against a stored hash.
 * Always runs a comparison so timing does not reveal whether the user exists.
 */
async function verifyPassword(plaintext, hash) {
  if (!hash) {
    // Dummy hash so a missing user costs the same time as a wrong password.
    await bcrypt.compare(plaintext || '', '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    return false;
  }
  return bcrypt.compare(plaintext || '', hash);
}

module.exports = { hashPassword, verifyPassword, ROUNDS };
