#!/usr/bin/env node
/**
 * Create a user with a bcrypt-hashed password.
 *
 *   node scripts/create-user.js --email you@hospital.et --role Admin \
 *     --employee-id EMP001 --first-name Yoseph --last-name Abraham
 *
 * The password is read from the PASSWORD environment variable or prompted for,
 * so it never ends up in your shell history.
 */
require('dotenv').config();
const readline = require('readline');
const { pool } = require('../src/db');
const { hashPassword } = require('../src/auth/passwords');

const ROLES = [
  'Admin', 'Physician', 'Nurse', 'Pharmacist',
  'Lab_Technician', 'Radiologist', 'Receptionist', 'Accountant',
];

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a); }));
}

(async () => {
  const email = arg('email');
  const role = arg('role');
  const employeeId = arg('employee-id');
  const firstName = arg('first-name');
  const lastName = arg('last-name');
  const department = arg('department') || null;

  if (!email || !role || !employeeId || !firstName || !lastName) {
    console.error('Required: --email --role --employee-id --first-name --last-name');
    console.error('Roles:', ROLES.join(', '));
    process.exit(1);
  }
  if (!ROLES.includes(role)) {
    console.error(`Invalid role "${role}". Must be one of: ${ROLES.join(', ')}`);
    process.exit(1);
  }

  const password = process.env.PASSWORD || (await prompt('Password (min 12 chars): '));

  try {
    const hash = await hashPassword(password);
    const { rows } = await pool.query(
      `INSERT INTO users
         (employee_id, first_name, last_name, email, password_hash, role, department,
          password_changed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING user_id, employee_id, email, role`,
      [employeeId, firstName, lastName, email, hash, role, department]
    );
    console.log('Created user:', rows[0]);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
