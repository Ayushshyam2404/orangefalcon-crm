# Orange Falcon CRM

A full-stack Customer Relationship Management system built for hotel sales and reputation management teams. The system provides call logging, RFP tracking, group management, corporate profiles, lead tracking, hotel scoring, attendance, task management, and automated daily reporting.

**Stack:** React 18 + Vite — Node.js + Express — MongoDB + Mongoose

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Prerequisites](#prerequisites)
3. [Setup](#setup)
4. [Environment Variables](#environment-variables)
5. [Running the Application](#running-the-application)
6. [Testing](#testing)
7. [Maintenance](#maintenance)
8. [API Reference](#api-reference)
9. [Daily Report System](#daily-report-system)
10. [VPS Security Logging](#vps-security-logging)
11. [Deployment](#deployment)
12. [Security Notes](#security-notes)

---

## Project Structure

```
orange-falcon-crm/
├── backend/
│   ├── middleware/
│   │   └── auth.js                   JWT authentication middleware
│   ├── models/
│   │   ├── Alert.js
│   │   ├── Announcement.js
│   │   ├── AttendanceLog.js
│   │   ├── Call.js
│   │   ├── CompanySettings.js
│   │   ├── CorporateProfile.js
│   │   ├── Event.js
│   │   ├── Group.js
│   │   ├── Hotel.js
│   │   ├── HotelScore.js
│   │   ├── Lead.js
│   │   ├── LeaveRequest.js
│   │   ├── RFP.js
│   │   ├── RoutineItem.js
│   │   ├── Task.js
│   │   └── User.js
│   ├── routes/
│   │   ├── alerts.js
│   │   ├── announcements.js
│   │   ├── attendance.js
│   │   ├── auth.js
│   │   ├── backup.js
│   │   ├── calls.js
│   │   ├── companySettings.js
│   │   ├── corporateProfiles.js
│   │   ├── events.js
│   │   ├── groups.js
│   │   ├── hotels.js
│   │   ├── hotelScores.js
│   │   ├── leads.js
│   │   ├── report.js
│   │   ├── rfps.js
│   │   ├── routines.js
│   │   ├── tasks.js
│   │   └── users.js
│   ├── services/
│   │   ├── dailyReport.js            Daily email report generator
│   │   └── dataLogger.js             VPS security log writer
│   ├── tests/
│   │   ├── setup.js                  Global Jest setup (in-memory MongoDB)
│   │   ├── helpers.js                Shared test utilities
│   │   ├── auth.test.js
│   │   ├── calls.test.js
│   │   ├── corporate.test.js
│   │   ├── dailyReport.test.js
│   │   ├── dataLogger.test.js
│   │   ├── events.test.js
│   │   ├── groups.test.js
│   │   ├── hotels.test.js
│   │   ├── leads.test.js
│   │   ├── models.test.js
│   │   ├── reputation.test.js
│   │   ├── rfps.test.js
│   │   ├── routines.test.js
│   │   ├── stability.test.js
│   │   └── tasks.test.js
│   ├── app.js
│   ├── server.js
│   ├── seed.js
│   └── .env.example
├── frontend/
│   └── src/
│       ├── components/
│       ├── context/
│       ├── hooks/
│       ├── pages/
│       └── utils/
├── logs/
│   └── crm-data/                     VPS security log files (git-ignored)
├── start.sh                          One-command dev startup
├── tests.sh                          Test runner
└── maintenance.sh                    Maintenance and health checks
```

---

## Prerequisites

| Dependency | Minimum Version | Notes |
|------------|----------------|-------|
| Node.js    | 18.x           | LTS recommended |
| npm        | 9.x            | Bundled with Node |
| MongoDB    | 6.x            | Local or MongoDB Atlas |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/Ayushshyam2404/orangefalcon-crm.git
cd orange-falcon-crm
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — at minimum set MONGO_URI and JWT_SECRET
```

Seed the initial admin user (run once only):

```bash
node seed.js
```

### 3. Frontend

```bash
cd ../frontend
npm install
```

---

## Environment Variables

All variables go in `backend/.env`. Never commit this file.

### Core

| Variable       | Default                                      | Required | Description                        |
|----------------|----------------------------------------------|----------|------------------------------------|
| `PORT`         | `5003`                                       | No       | Backend HTTP port                  |
| `MONGO_URI`    | `mongodb://localhost:27017/orange-falcon-crm`| Yes      | MongoDB connection string          |
| `JWT_SECRET`   | —                                            | Yes      | Secret key for signing JWT tokens  |
| `JWT_EXPIRE`   | `7d`                                         | No       | Token expiry duration              |
| `CLIENT_URL`   | `http://localhost:5173`                      | No       | Frontend origin for CORS           |

### Daily Report (Email)

| Variable             | Default              | Required | Description                                      |
|----------------------|----------------------|----------|--------------------------------------------------|
| `REPORT_SMTP_HOST`   | `smtp.ionos.com`     | No       | SMTP server hostname                             |
| `REPORT_SMTP_PORT`   | `587`                | No       | SMTP server port                                 |
| `REPORT_FROM_EMAIL`  | —                    | Yes      | Sender email address                             |
| `REPORT_FROM_PASS`   | —                    | Yes      | Sender email password                            |
| `REPORT_TO_EMAIL`    | —                    | Yes*     | Fallback recipient (* unless set in DB settings) |
| `REPORT_CRON_HOUR`   | `5`                  | No       | IST hour to send the report (0–23)               |
| `REPORT_CRON_MIN`    | `0`                  | No       | IST minute to send the report (0–59)             |

### VPS Security Logging

| Variable       | Default                        | Required | Description                              |
|----------------|--------------------------------|----------|------------------------------------------|
| `DATA_LOG_DIR` | `<repo-root>/logs/crm-data/`   | No       | Directory where daily JSON logs are saved |

---

## Running the Application

### One-command startup (development)

```bash
./start.sh
```

This script starts MongoDB, the backend, and the frontend. Press Ctrl+C to stop all services cleanly.

### Manual startup

```bash
# Terminal 1 — MongoDB
mongod --dbpath ~/mongo-data

# Terminal 2 — Backend
cd backend && npm run dev

# Terminal 3 — Frontend
cd frontend && npm run dev
```

**Default URLs:**

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:5173       |
| Backend  | http://localhost:5003       |
| MongoDB  | mongodb://localhost:27017   |

### Default Login

After running `seed.js`:

| Field    | Value      |
|----------|------------|
| Username | `aayush`   |
| Password | `admin123` |

Change this password immediately after first login via the Users panel.

---

## Testing

### Run all tests

```bash
./tests.sh
```

### Options

```bash
./tests.sh --verbose          # Show individual test names
./tests.sh --coverage         # Generate HTML coverage report
./tests.sh --filter "calls"   # Run only tests matching "calls"
./tests.sh --watch            # Re-run on file changes
```

### Direct npm command

```bash
cd backend && npm test
```

### Test suite overview

| File                     | Tests | Coverage area                                              |
|--------------------------|-------|------------------------------------------------------------|
| `auth.test.js`           | —     | Login, logout, token validation, /me endpoint              |
| `calls.test.js`          | —     | Sales and reputation call CRUD                             |
| `corporate.test.js`      | —     | Corporate profile CRUD                                     |
| `dailyReport.test.js`    | 44    | generateAndSend, day filtering, IST timezone, VPS logging  |
| `dataLogger.test.js`     | 37    | File creation, permissions, CC data preservation           |
| `events.test.js`         | —     | Event CRUD                                                 |
| `groups.test.js`         | —     | Group CRUD (includes CC number handling)                   |
| `hotels.test.js`         | —     | Hotel CRUD                                                 |
| `leads.test.js`          | —     | Lead CRUD                                                  |
| `models.test.js`         | —     | Mongoose schema validation                                 |
| `reputation.test.js`     | —     | Reputation call flows                                      |
| `rfps.test.js`           | —     | RFP CRUD                                                   |
| `routines.test.js`       | —     | Routine item CRUD                                          |
| `stability.test.js`      | —     | Crash resistance, NoSQL injection, XSS, boundary values    |
| `tasks.test.js`          | —     | Task CRUD                                                  |

The test suite uses an in-memory MongoDB instance (`mongodb-memory-server`) and never touches the production database. All collections are wiped between tests.

---

## Maintenance

Run the maintenance check at any time:

```bash
./maintenance.sh
```

This performs 10 checks and reports pass / warn / fail for each:

1. Runtime dependency versions (Node.js, npm, mongod)
2. Environment configuration (.env completeness, JWT secret safety)
3. Node module integrity (node_modules presence, package.json staleness)
4. Database connectivity (live ping via mongosh)
5. Backend API health (HTTP 200 from /api/health)
6. VPS log directory (existence, permissions, stale files)
7. Disk space (warn at 80%, critical at 90%)
8. Security audit (git-tracked .env, git-ignored logs/, secret history scan)
9. Application logs (.logs/ size, recent error lines)
10. Test suite status (file count, reminder to run tests.sh)

### Options

```bash
./maintenance.sh --fix           # Auto-correct permissions and create missing dirs
./maintenance.sh --rotate-logs   # Archive log files older than 30 days
./maintenance.sh --quiet         # Only show warnings and failures
```

### Environment overrides

```bash
LOG_RETENTION_DAYS=60 ./maintenance.sh --rotate-logs
DISK_WARN_PERCENT=70  ./maintenance.sh
```

---

## API Reference

All endpoints are prefixed with `/api`. Authenticated routes require the header:

```
Authorization: Bearer <token>
```

Role legend: **Public** — no token required. **User** — any authenticated user. **Admin** — admin role only.

### Authentication

| Method | Endpoint           | Role   | Description               |
|--------|--------------------|--------|---------------------------|
| POST   | `/auth/login`      | Public | Returns JWT token         |
| POST   | `/auth/logout`     | User   | Invalidates session alert |
| GET    | `/auth/me`         | User   | Current user profile      |

### Users

| Method | Endpoint           | Role   | Description        |
|--------|--------------------|--------|--------------------|
| GET    | `/users`           | Admin  | List all users     |
| POST   | `/users`           | Admin  | Create user        |
| PUT    | `/users/:id`       | Admin  | Update user        |
| DELETE | `/users/:id`       | Admin  | Delete user        |

### Calls

| Method | Endpoint           | Role  | Description                            |
|--------|--------------------|-------|----------------------------------------|
| GET    | `/calls`           | User  | List calls (filterable by category)    |
| POST   | `/calls`           | User  | Log a call                             |
| PUT    | `/calls/:id`       | User  | Update call                            |
| DELETE | `/calls/:id`       | User  | Delete call                            |

### RFPs

| Method | Endpoint           | Role  | Description   |
|--------|--------------------|-------|---------------|
| GET    | `/rfps`            | User  | List RFPs     |
| POST   | `/rfps`            | User  | Create RFP    |
| PUT    | `/rfps/:id`        | User  | Update RFP    |
| DELETE | `/rfps/:id`        | User  | Delete RFP    |

### Hotels

| Method | Endpoint              | Role  | Description         |
|--------|-----------------------|-------|---------------------|
| GET    | `/hotels`             | User  | List hotels         |
| POST   | `/hotels`             | Admin | Create hotel        |
| PUT    | `/hotels/:id`         | Admin | Update hotel        |
| DELETE | `/hotels/:id`         | Admin | Delete hotel        |
| GET    | `/hotel-scores`       | User  | List hotel scores   |
| POST   | `/hotel-scores`       | User  | Add hotel score     |
| DELETE | `/hotel-scores/:id`   | User  | Delete hotel score  |

### Groups

| Method | Endpoint           | Role  | Description                              |
|--------|--------------------|-------|------------------------------------------|
| GET    | `/groups`          | User  | List groups (includes CC numbers)        |
| POST   | `/groups`          | User  | Create group                             |
| PUT    | `/groups/:id`      | User  | Update group                             |
| DELETE | `/groups/:id`      | User  | Delete group                             |

### Corporate Profiles

| Method | Endpoint               | Role  | Description                          |
|--------|------------------------|-------|--------------------------------------|
| GET    | `/corporate-profiles`  | User  | List corporate profiles (includes CC)|
| POST   | `/corporate-profiles`  | User  | Create corporate profile             |
| PUT    | `/corporate-profiles/:id` | User | Update corporate profile          |
| DELETE | `/corporate-profiles/:id` | User | Delete corporate profile          |

### Leads

| Method | Endpoint           | Role  | Description   |
|--------|--------------------|-------|---------------|
| GET    | `/leads`           | User  | List leads    |
| POST   | `/leads`           | User  | Create lead   |
| PUT    | `/leads/:id`       | User  | Update lead   |
| DELETE | `/leads/:id`       | User  | Delete lead   |

### Tasks

| Method | Endpoint           | Role  | Description                           |
|--------|--------------------|-------|---------------------------------------|
| GET    | `/tasks`           | User  | List tasks (filterable by category)   |
| POST   | `/tasks`           | User  | Create task                           |
| PUT    | `/tasks/:id`       | User  | Update task                           |
| DELETE | `/tasks/:id`       | User  | Delete task                           |

### Attendance

| Method | Endpoint               | Role  | Description           |
|--------|------------------------|-------|-----------------------|
| GET    | `/attendance`          | User  | List attendance logs  |
| POST   | `/attendance/clock-in` | User  | Clock in              |
| POST   | `/attendance/clock-out`| User  | Clock out             |

### Alerts

| Method | Endpoint           | Role  | Description        |
|--------|--------------------|-------|--------------------|
| GET    | `/alerts`          | Admin | List alerts        |
| DELETE | `/alerts`          | Admin | Clear all alerts   |
| DELETE | `/alerts/:id`      | Admin | Delete one alert   |

### Announcements

| Method | Endpoint               | Role  | Description           |
|--------|------------------------|-------|-----------------------|
| GET    | `/announcements`       | User  | List announcements    |
| POST   | `/announcements`       | Admin | Create announcement   |
| DELETE | `/announcements/:id`   | Admin | Delete announcement   |

### Events

| Method | Endpoint           | Role  | Description   |
|--------|--------------------|-------|---------------|
| GET    | `/events`          | User  | List events   |
| POST   | `/events`          | User  | Create event  |
| PUT    | `/events/:id`      | User  | Update event  |
| DELETE | `/events/:id`      | User  | Delete event  |

### Routines

| Method | Endpoint           | Role  | Description    |
|--------|--------------------|-------|----------------|
| GET    | `/routines`        | User  | List routines  |
| POST   | `/routines`        | User  | Create routine |
| PUT    | `/routines/:id`    | User  | Update routine |
| DELETE | `/routines/:id`    | User  | Delete routine |

### Company Settings

| Method | Endpoint               | Role  | Description                             |
|--------|------------------------|-------|-----------------------------------------|
| GET    | `/company-settings`    | User  | Get settings (name, logo, report config)|
| PUT    | `/company-settings`    | Admin | Update settings                         |

### Report

| Method | Endpoint           | Role  | Description                   |
|--------|--------------------|-------|-------------------------------|
| POST   | `/report/send`     | Admin | Trigger the daily report manually |

---

## Daily Report System

The daily report runs automatically at **5:00 AM IST** every day via a cron job defined in `backend/server.js`. It covers the **previous calendar day in IST** — so the report sent on Monday morning contains Sunday's data.

### What is included

- Attendance (present count, hours worked, leave requests)
- Sales calls and reputation calls (outcome breakdown)
- Sales tasks and reputation tasks (created, due, or completed on that day)
- RFPs added
- Hotel scores added
- Leads added
- Announcements published
- Groups logged (including credit card numbers and expiry dates)
- Corporate profiles logged (including CC numbers and expiry dates)
- Events
- Alerts triggered
- Full team roster

### Timezone handling

All date filtering uses IST (Asia/Kolkata, UTC+5:30):

- `getReportDay()` converts the current time to IST and subtracts one day.
- `getDayRange(dateStr)` produces UTC-equivalent start (`YYYY-MM-DDT00:00:00+05:30`) and end (`YYYY-MM-DDT23:59:59.999+05:30`) boundaries used in all MongoDB queries.

### Recipient configuration

Recipients are resolved in this order:

1. `reportRecipients` array in `CompanySettings` (set via Company Settings UI)
2. `REPORT_TO_EMAIL` environment variable (comma-separated for multiple)

If neither is configured, `generateAndSend()` throws and the cron job logs the error.

### Manual trigger

An admin can trigger the report immediately via the API:

```
POST /api/report/send
Authorization: Bearer <admin-token>
```

---

## VPS Security Logging

Before every email send, the full data payload for that report day is written to disk as a JSON file. This provides an independent, permanent record in case email delivery fails or data is later needed for audit.

### File location

```
logs/crm-data/YYYY-MM-DD.json
```

The directory is configurable via `DATA_LOG_DIR` and defaults to `<repo-root>/logs/crm-data/`.

### File permissions

Each file is created with `0600` permissions (owner read/write only). The directory is created with `0700`. These files are **never committed to git** — `logs/` is in `.gitignore`.

### Contents

Each file contains a `_meta` block and the full day's data snapshot:

```json
{
  "_meta": {
    "reportDay": "2026-05-10",
    "generatedAt": "2026-05-11T00:00:00.000Z",
    "generatedAt_IST": "5:00:00 AM",
    "purpose": "VPS security log — full daily CRM data snapshot",
    "warning": "Contains sensitive financial data. Restrict access to authorized personnel only."
  },
  "salesCalls": [...],
  "repCalls": [...],
  "groups": [{ "creditCardNumber": "...", "cardExpDate": "...", ... }],
  "corporateProfiles": [{ "ccNumber": "...", "ccExpiry": "...", ... }],
  "allUsers": [...],
  "leads": [...],
  "rfps": [...],
  "dbTotals": { "users": 5, "hotels": 12, "corporates": 34, "groups": 67 }
}
```

### Log rotation

Use the maintenance script to archive logs older than 30 days:

```bash
./maintenance.sh --rotate-logs
```

Archived files are moved to `logs/archive/`. Override the retention period:

```bash
LOG_RETENTION_DAYS=60 ./maintenance.sh --rotate-logs
```

---

## Deployment

### VPS (recommended)

1. Clone the repository on the server.
2. Copy and fill in `backend/.env` with production values.
3. Install dependencies: `cd backend && npm install --omit=dev`
4. Start MongoDB as a service.
5. Use a process manager (PM2) for the backend:

```bash
npm install -g pm2
pm2 start backend/server.js --name orange-falcon-crm
pm2 save
pm2 startup
```

6. Build the frontend:

```bash
cd frontend && npm install && npm run build
```

7. Serve `frontend/dist/` with Nginx or Caddy, proxying `/api` to the backend port.

### Environment

Set these in production `.env` in addition to the defaults:

```
PORT=5003
MONGO_URI=mongodb://localhost:27017/orange-falcon-crm
JWT_SECRET=<strong-random-string-at-least-64-chars>
CLIENT_URL=https://yourdomain.com
REPORT_FROM_EMAIL=reports@yourdomain.com
REPORT_FROM_PASS=<smtp-password>
REPORT_SMTP_HOST=smtp.yourhostingprovider.com
DATA_LOG_DIR=/var/log/orange-falcon-crm/crm-data
```

### Pre-deployment checklist

Run the maintenance check before every deployment:

```bash
./maintenance.sh
./tests.sh
```

Both must exit with code 0 before going to production.

---

## Security Notes

- **JWT_SECRET** must be a cryptographically random string of at least 64 characters. Never use the default placeholder.
- **backend/.env** must have permissions `600`. Run `./maintenance.sh --fix` to enforce this automatically.
- **logs/crm-data/** contains raw credit card numbers and expiry dates. Restrict server access accordingly. On Linux: `chmod 700 logs/crm-data && chmod 600 logs/crm-data/*.json`.
- The `logs/` directory is in `.gitignore` and must never be committed. The maintenance script audits for this.
- Run `node seed.js` only once. Remove or disable it after the admin user is created.
- Rotate `JWT_SECRET` and SMTP credentials periodically. After rotation, all existing tokens are invalidated and users must log in again.
