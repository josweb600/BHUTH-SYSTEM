# Bule Hora University Teaching Hospital — EHMS

Electronic hospital management system: a PostgreSQL data layer, an Express REST API, and a React front end covering patient records, appointments, laboratory, radiology, pharmacy, billing, inventory, and staff scheduling.

## Repository layout

```
backend/            Express REST API
  src/server.js     API entrypoint (patients, appointments, lab, billing, analytics)
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

## API endpoints

| Method | Path                      | Description                          |
| ------ | ------------------------- | ------------------------------------ |
| GET    | `/api/health`             | Service and database health          |
| GET    | `/api/patients`           | List patients (`page`, `limit`, `search`) |
| GET    | `/api/patients/:id`       | Single patient                       |
| POST   | `/api/patients`           | Create patient (`mrn`, `first_name`, `last_name` required) |
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
| `JWT_SECRET`   | backend  | Sign with a random 48-byte value         |
| `VITE_API_PROXY` | frontend | Dev-server API target                  |

`.env` is git-ignored. Only `.env.example` is committed — never commit real
credentials, and rotate anything that has been shared.

## Security notes

This system is designed to hold patient health information. Before any
deployment that touches real records:

- Set every `CHANGE_ME` value in `.env` to a strong unique secret.
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
