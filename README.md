# Bule Hora University Teaching Hospital — EHMS

Electronic hospital management system: a PostgreSQL data layer, an Express REST API, and a React front end covering patient records, appointments, laboratory, radiology, pharmacy, billing, inventory, and staff scheduling.

## Repository layout

```
backend/            Express REST API
  src/server.js     API entrypoint (patients, appointments, lab, billing, analytics)
  src/db.js         Shared PostgreSQL connection pool
  src/auth/         Password hashing and JWT signing/verification
  src/middleware/   Bearer-token auth, role checks, audit logging
  src/routes/       Auth, patients, appointments, lab tests, bills, analytics
  src/validators.js Request validation mirroring the schema constraints
  scripts/          create-user.js for provisioning accounts
  test/             Unit tests (no database required)
  test/integration/ End-to-end tests against a real PostgreSQL instance
  Dockerfile        Multi-stage: development / production
  .env.example      Required environment variables
frontend/           React single-page app (Vite + Tailwind CSS)
  src/main.jsx      Application entrypoint
  src/App.jsx       Routing across the seven module UIs
  src/components/   AdminDashboard, AnalyticsDashboard, PatientPortal, ...
  nginx.conf        Production reverse proxy and security headers
  Dockerfile        Multi-stage: development / build / production
database/
  schema.sql        PostgreSQL schema — 27 tables, indexes, triggers, views
docs/               Design, API, deployment, compliance and training documents
scripts/            Setup and repository helper scripts
legacy/             Original static HTML prototypes, kept for reference
index.html          GitHub Pages landing page
docker-compose.yml  Postgres, backend, frontend, Redis, pgAdmin
```

## Quick start with Docker

```bash
cp .env.example .env        # then edit .env and set real passwords
docker compose up --build
```

| Service  | URL                     |
| -------- | ----------------------- |
| Frontend | http://localhost:3000   |
| API      | http://localhost:3001   |
| Health   | http://localhost:3001/api/health |
| pgAdmin  | http://localhost:5050   |

The schema in `database/schema.sql` is applied automatically the first time the
Postgres volume is created.

## Running without Docker

Backend:

```bash
cd backend
cp .env.example .env        # set DATABASE_URL and JWT_SECRET
npm install
npm run db:init             # loads database/schema.sql
npm run dev                 # http://localhost:3001
```

Frontend:

```bash
cd frontend
npm install
npm run dev                 # http://localhost:3000, /api proxied to :3001
npm run build               # production bundle in frontend/dist
```

## Authentication

Every endpoint except `/api/health`, `/api/auth/login` and `/api/auth/refresh`
requires a bearer access token. Access tokens last 15 minutes; refresh tokens
last 7 days and are rotated on every use. Sessions are recorded in
`user_sessions` as SHA-256 hashes, so logging out revokes a token immediately
and a stolen database dump cannot be replayed against the API.

Create the first user:

```bash
cd backend
npm run create-user -- --email admin@hospital.et --role Admin \
  --employee-id EMP001 --first-name Yoseph --last-name Abraham
```

Log in and call a protected endpoint:

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@hospital.et","password":"..."}' | jq -r .access_token)

curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/patients
```

### Roles

`users.role` is one of `Admin`, `Physician`, `Nurse`, `Pharmacist`,
`Lab_Technician`, `Radiologist`, `Receptionist`, `Accountant`. Access per
endpoint:

| Endpoint                    | Allowed roles                                             |
| --------------------------- | --------------------------------------------------------- |
| `GET /api/patients`         | all clinical, reception, lab, radiology, accounting roles  |
| `POST /api/patients`        | Admin, Receptionist, Physician, Nurse                     |
| `PATCH /api/patients/:id`   | Admin, Receptionist, Physician, Nurse (fields vary by role) |
| `DELETE /api/patients/:id`  | Admin                                                     |
| `GET /api/appointments`     | Admin, Physician, Nurse, Receptionist                     |
| `POST /api/appointments`    | Admin, Receptionist, Physician, Nurse                     |
| `PATCH /api/appointments/:id` | Admin, Receptionist, Physician, Nurse (fields vary by role) |
| `DELETE /api/appointments/:id` | Admin, Receptionist, Physician (purge: Admin only)     |
| `GET /api/lab-tests`        | Admin, Physician, Nurse, Lab_Technician                   |
| `POST /api/lab-tests`       | Admin, Physician, Nurse                                   |
| `PATCH /api/lab-tests/:id`  | Admin, Physician, Nurse, Lab_Technician (fields vary by role) |
| `DELETE /api/lab-tests/:id` | Admin, Physician, Nurse (purge: Admin only)               |
| `GET /api/bills`            | Admin, Accountant, Receptionist                           |
| `POST /api/bills`           | Admin, Accountant                                         |
| `PATCH /api/bills/:id`      | Admin, Accountant                                         |
| `DELETE /api/bills/:id`     | Admin, Accountant (purge: Admin only)                     |
| `GET /api/analytics/dashboard` | Admin, Accountant                                      |

### Field-level write permissions

PATCH applies an allowlist per role, not just per endpoint. A field the caller
may not write is rejected with 400 and the list of fields they can write, rather
than being silently dropped from the update.

| Resource | Role | May change |
| -------- | ---- | ---------- |
| Patient | Admin, Physician | any updatable field |
| Patient | Nurse | demographics and contact details, `blood_type` |
| Patient | Receptionist | demographics and contact details only |
| Appointment | Admin | any updatable field, including reassigning `doctor_id` |
| Appointment | Receptionist | `appointment_date`, `status`, `appointment_type`, `notes`, `reminder_sent` |
| Appointment | Physician | `appointment_date`, `status`, `appointment_type`, `notes` |
| Appointment | Nurse | `status`, `appointment_type`, `notes`, `reminder_sent` |
| Lab test | Admin, Physician | any updatable field |
| Lab test | Nurse | everything except `test_type` |
| Lab test | Lab_Technician | `specimen_type`, `specimen_date`, `status` |
| Bill | Admin, Accountant | dates and amounts; `status` is re-derived |

Some columns are not writable by anyone through PATCH:

- `patients.mrn` - every other record and every paper chart refers to it.
- `bills.bill_number` - it is printed on the patient's copy and quoted on payment.
- `bills.patient_responsibility` - derived from the amounts, never accepted from a client.
- `lab_tests.ordered_by`, `bills.created_by`, and a Physician's own `doctor_id` on
  creation, all of which come from the authenticated token.

Patient reads and all writes are appended to `audit_logs` with the acting user
and client IP.

## Tests

```bash
cd backend
npm test              # 47 unit tests, no database required
npm run test:integration   # 76 end-to-end tests against a real PostgreSQL
npm run test:all
```

`npm run test:integration` starts an actual PostgreSQL 18 in-process (PGlite,
compiled to WebAssembly), loads `database/schema.sql` into it unmodified, and
drives the running API over HTTP. Nothing is mocked: the CHECK constraints,
NOT NULL columns, foreign keys and `uuid_generate_v4()` defaults are the real
ones, so a query that does not match the schema fails the suite.

`test/integration/mutations.test.js` covers PATCH and DELETE specifically,
including the cascade behaviour: it creates a patient with an appointment and a
lab test, purges them, and asserts both that the dependent rows are gone and that
the `audit_logs` entry describing the purge is still there.

## API endpoints

| Method | Path                      | Description                          |
| ------ | ------------------------- | ------------------------------------ |
| GET    | `/api/health`             | Service and database health (public) |
| POST   | `/api/auth/login`         | Exchange email and password for tokens (public) |
| POST   | `/api/auth/refresh`       | Rotate an expiring token pair (public) |
| POST   | `/api/auth/logout`        | Revoke the current session           |
| POST   | `/api/auth/logout-all`    | Revoke every session for the user    |
| GET    | `/api/auth/me`            | Authenticated user's profile         |
| GET    | `/api/patients`           | List patients (`page`, `limit`, `search`) |
| GET    | `/api/patients/:id`       | Single patient                       |
| POST   | `/api/patients`           | Create patient (`mrn`, `first_name`, `last_name`, `date_of_birth`, `gender`, `phone` required) |
| PATCH  | `/api/patients/:id`       | Update the supplied fields only      |
| DELETE | `/api/patients/:id`       | Deactivate; `?purge=true&confirm=<mrn>` deletes for real |
| GET    | `/api/appointments`       | Filter by `patient_id`, `status`, `start_date`, `end_date` |
| POST   | `/api/appointments`       | Schedule an appointment              |
| PATCH  | `/api/appointments/:id`   | Reschedule, re-status or annotate    |
| DELETE | `/api/appointments/:id`   | Cancel; `?purge=true` deletes for real |
| GET    | `/api/lab-tests`          | Filter by `patient_id`, `status`     |
| POST   | `/api/lab-tests`          | Order a lab test                     |
| PATCH  | `/api/lab-tests/:id`      | Advance status, record specimen details |
| DELETE | `/api/lab-tests/:id`      | Cancel; `?purge=true` deletes for real |
| GET    | `/api/bills`              | Filter by `patient_id`, `status`     |
| POST   | `/api/bills`              | Create a bill                        |
| PATCH  | `/api/bills/:id`          | Adjust amounts; totals and status re-derived |
| DELETE | `/api/bills/:id`          | Cancel; `?purge=true` deletes for real |
| GET    | `/api/analytics/dashboard`| Patient, appointment, lab, billing totals |

Full request and response examples are in `docs/API_Reference_Documentation.docx`.

### What PATCH does

Only the keys present in the body are written. A key that is absent is left
alone; a key set to `null` clears the column, so the two are not
interchangeable. The response includes `changed_fields`, listing what actually
moved - sending a field its current value is accepted but changes nothing and is
not audited.

Amounts on a bill are never taken at face value. Any change to `total_amount`,
`discount_amount`, `insurance_amount` or `paid_amount` recalculates
`patient_responsibility` and, unless the caller states a `status` explicitly,
re-derives the status from the balance. A `paid_amount` above what is owed is a
400 rather than a bill that reads Paid while money is outstanding.

Some records are closed to editing because changing them would rewrite history
rather than correct it: a Completed or Cancelled appointment, a Completed lab
test, and a Cancelled bill. Each returns 409 with the alternative - book a new
appointment, order a repeat test, issue a new bill.

### What DELETE does

DELETE deactivates or cancels; it does not remove rows. `patients` becomes
`Inactive`, and `appointments`, `lab_tests` and `bills` become `Cancelled`. This
is deliberate:

- Nine tables reference `patients(patient_id)` with `ON DELETE CASCADE` -
  `patient_contacts`, `patient_insurance`, `patient_allergies`,
  `medical_records`, `appointments`, `lab_tests`, `radiology_orders`,
  `prescriptions` and `bills`. One row delete would silently erase a patient's
  entire clinical and financial history, including records that retention rules
  require keeping.
- A cancelled appointment and an appointment that never existed are different
  facts. No-shows and late cancellations are exactly the pattern the
  `appointments` table is there to show.
- Deleting a bill leaves a gap in the `bill_number` sequence, which is the first
  thing an auditor looks for.

A real delete is available for genuine mis-entries, at `?purge=true`, Admin only.
Purging a patient additionally requires their MRN in `?confirm=`, and the
response reports the row counts the cascade removed. Purging is refused outright
when it would destroy a financial or clinical fact: a patient with settled bills,
a bill with any payment against it, or a Completed lab test.

Both paths are recorded in `audit_logs` as `DELETE`. On the purge path the audit
row is written inside the same transaction as the delete, and deliberately not
through the helper that swallows its own errors - if the record of who destroyed
the data cannot be written, the data is not destroyed. `audit_logs.user_id` is
`ON DELETE SET NULL` and `entity_id` is text, so those rows outlive the records
they describe.

### Audit trail

Every PATCH and DELETE appends to `audit_logs` with the acting user from the
token, the client IP, and `old_values`/`new_values` holding only the fields that
changed. Values are compared with the driver's representation in mind: `NUMERIC`
comes back as a string, so `'250.00'` and `250` are the same amount and are not
logged as an edit.

This matters most for `lab_tests`, which has no `updated_at` column at all -
`audit_logs` is the only record that a test changed. `appointments` has the column
but `schema.sql` defines no `update_timestamp` trigger for it, unlike `patients`,
`users` and `bills`, so the API sets `updated_at` explicitly rather than relying
on a trigger that may not be installed.

## Environment variables

| Variable       | Used by  | Notes                                    |
| -------------- | -------- | ---------------------------------------- |
| `PORT`         | backend  | Defaults to 3001                         |
| `DATABASE_URL` | backend  | PostgreSQL connection string             |
| `JWT_SECRET`   | backend  | Random value, minimum 32 characters      |
| `JWT_ACCESS_TTL` | backend | Access token lifetime, default `15m`   |
| `JWT_REFRESH_TTL` | backend | Refresh token lifetime, default `7d`  |
| `BCRYPT_ROUNDS` | backend | Password hash cost, default 12          |
| `CORS_ORIGIN`  | backend  | Comma-separated allowlist of browser origins |
| `LOGIN_RATE_LIMIT` | backend | Failed logins per IP per 15 min, default 10 |
| `TRUST_PROXY_HOPS` | backend | Proxies in front of the API, nginx = 1 |
| `PG_POOL_MAX`  | backend  | Connection pool size, default 10         |
| `VITE_API_PROXY` | frontend | Dev-server API target                  |

`.env` is git-ignored. Only `.env.example` is committed — never commit real
credentials, and rotate anything that has been shared.

## Security notes

This system is designed to hold patient health information. Before any
deployment that touches real records:

- Set every `CHANGE_ME` value in `.env` to a strong unique secret.
- `users.mfa_enabled` defaults to `true` but no second factor is implemented
  yet. Treat multi-factor authentication as outstanding, not delivered.
- `audit_logs` grows without bound and is never rotated or archived. It is also
  the only place a lab test change is recorded, so it cannot simply be truncated.
- `schema.sql` has no `update_timestamp` trigger on `appointments` and no
  `updated_at` column on `lab_tests`. The API works around both, but a client
  writing to the database directly would not.
- Expired `user_sessions` rows are never swept.
- Around twenty schema tables, including `patient_insurance`, `patient_contacts`,
  `medical_records` and `prescriptions`, still have no endpoints.
- Set `CORS_ORIGIN` to your real front-end origin; the default only permits
  `localhost:3000`.
- Restrict Postgres and pgAdmin so they are not reachable from the public internet.
- Terminate TLS in front of nginx; the API sends no credentials over plain HTTP.
- Review `docs/HIPAA_Compliance_and_Security_Guide.docx` and
  `docs/Security_Hardening_Checklist.docx`.
- Keep this repository private if the schema or configuration reflects the
  production deployment.

## Documentation

Design, deployment, disaster recovery, testing, training, and compliance
documents are in `docs/`. Start with
`docs/PROJECT_SUMMARY_AND_DELIVERABLES.docx`.
