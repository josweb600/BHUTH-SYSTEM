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
| `GET /api/appointments`     | Admin, Physician, Nurse, Receptionist                     |
| `POST /api/appointments`    | Admin, Receptionist, Physician, Nurse                     |
| `GET /api/lab-tests`        | Admin, Physician, Nurse, Lab_Technician                   |
| `POST /api/lab-tests`       | Admin, Physician, Nurse                                   |
| `GET /api/bills`            | Admin, Accountant, Receptionist                           |
| `POST /api/bills`           | Admin, Accountant                                         |
| `GET /api/analytics/dashboard` | Admin, Accountant                                      |

Patient reads and all writes are appended to `audit_logs` with the acting user
and client IP.

## Tests

```bash
cd backend
npm test              # unit tests, no database required
npm run test:integration   # end-to-end against a real PostgreSQL
npm run test:all
```

`npm run test:integration` starts an actual PostgreSQL 18 in-process (PGlite,
compiled to WebAssembly), loads `database/schema.sql` into it unmodified, and
drives the running API over HTTP. Nothing is mocked: the CHECK constraints,
NOT NULL columns, foreign keys and `uuid_generate_v4()` defaults are the real
ones, so a query that does not match the schema fails the suite.

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
| GET    | `/api/appointments`       | Filter by `patient_id`, `status`, `start_date`, `end_date` |
| POST   | `/api/appointments`       | Schedule an appointment              |
| GET    | `/api/lab-tests`          | Filter by `patient_id`, `status`     |
| POST   | `/api/lab-tests`          | Order a lab test                     |
| GET    | `/api/bills`              | Filter by `patient_id`, `status`     |
| POST   | `/api/bills`              | Create a bill                        |
| GET    | `/api/analytics/dashboard`| Patient, appointment, lab, billing totals |

Full request and response examples are in `docs/API_Reference_Documentation.docx`.

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
