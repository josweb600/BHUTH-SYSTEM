/**
 * Unit tests for the authentication primitives. These run without a database
 * so they work in CI: `npm test` inside backend/.
 */
const test = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-1234567890';
process.env.BCRYPT_ROUNDS = '4'; // keep the test suite fast

const { hashPassword, verifyPassword } = require('../src/auth/passwords');
const {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  hashToken,
  refreshExpiryDate,
} = require('../src/auth/tokens');

test('password hashing produces a verifiable bcrypt hash', async () => {
  const hash = await hashPassword('correct horse battery staple');
  assert.match(hash, /^\$2[aby]\$/);
  assert.notStrictEqual(hash, 'correct horse battery staple');
  assert.strictEqual(await verifyPassword('correct horse battery staple', hash), true);
  assert.strictEqual(await verifyPassword('wrong password entirely', hash), false);
});

test('passwords shorter than 12 characters are rejected', async () => {
  await assert.rejects(() => hashPassword('short'), /at least 12 characters/);
});

test('verifying against a missing hash returns false rather than throwing', async () => {
  assert.strictEqual(await verifyPassword('anything', undefined), false);
  assert.strictEqual(await verifyPassword('anything', null), false);
});

test('access tokens carry the user id and role', () => {
  const token = signAccessToken({ userId: 'u-1', role: 'Physician', employeeId: 'EMP7' });
  const payload = verifyToken(token, 'access');
  assert.strictEqual(payload.sub, 'u-1');
  assert.strictEqual(payload.role, 'Physician');
  assert.strictEqual(payload.employee_id, 'EMP7');
});

test('a refresh token cannot be used as an access token', () => {
  const refresh = signRefreshToken({ userId: 'u-1' });
  assert.throws(() => verifyToken(refresh, 'access'), /Expected a access token/);
  assert.strictEqual(verifyToken(refresh, 'refresh').sub, 'u-1');
});

test('refresh tokens do not leak the role', () => {
  const payload = verifyToken(signRefreshToken({ userId: 'u-1' }), 'refresh');
  assert.strictEqual(payload.role, undefined);
});

test('a tampered token is rejected', () => {
  const token = signAccessToken({ userId: 'u-1', role: 'Nurse', employeeId: 'E1' });
  const parts = token.split('.');
  const forged = `${parts[0]}.${Buffer.from(
    JSON.stringify({ sub: 'u-1', role: 'Admin', typ: 'access' })
  ).toString('base64url')}.${parts[2]}`;
  assert.throws(() => verifyToken(forged, 'access'));
});

test('a token signed with a different secret is rejected', () => {
  const token = signAccessToken({ userId: 'u-1', role: 'Nurse', employeeId: 'E1' });
  const original = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'a-completely-different-secret-value-0987654321xyz';
  assert.throws(() => verifyToken(token, 'access'), /signature/i);
  process.env.JWT_SECRET = original;
});

test('a weak JWT_SECRET is refused', () => {
  const original = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'CHANGE_ME';
  assert.throws(
    () => signAccessToken({ userId: 'u-1', role: 'Admin', employeeId: 'E1' }),
    /at least 32 characters/
  );
  process.env.JWT_SECRET = original;
});

test('tokens are stored as stable sha256 hashes, not plaintext', () => {
  const token = signAccessToken({ userId: 'u-1', role: 'Admin', employeeId: 'E1' });
  const digest = hashToken(token);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.strictEqual(digest, hashToken(token));
  assert.notStrictEqual(digest, token);
});

test('refresh expiry is in the future and respects JWT_REFRESH_TTL', () => {
  process.env.JWT_REFRESH_TTL = '7d';
  const expiry = refreshExpiryDate();
  assert.ok(expiry > new Date());
  const days = (expiry - Date.now()) / 86400000;
  assert.ok(days > 6.9 && days < 7.1, `expected ~7 days, got ${days}`);
});

test('two tokens signed in the same second are never identical', () => {
  // iat has one-second resolution, so without a random jti rotation could hand
  // back the exact token it was meant to replace.
  const args = { userId: 'u1', role: 'Admin', employeeId: 'EMP001' };
  const access = new Set([signAccessToken(args), signAccessToken(args), signAccessToken(args)]);
  assert.strictEqual(access.size, 3);

  const refresh = new Set([
    signRefreshToken({ userId: 'u1' }),
    signRefreshToken({ userId: 'u1' }),
    signRefreshToken({ userId: 'u1' }),
  ]);
  assert.strictEqual(refresh.size, 3);

  // Distinct plaintext must also mean distinct stored hashes.
  assert.strictEqual(new Set([...refresh].map(hashToken)).size, 3);
});
