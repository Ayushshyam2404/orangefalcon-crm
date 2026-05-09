# 🦅 Orange Falcon CRM

Full-stack CRM built for hotel sales & reputation management.

**Stack:** React + Vite · Node.js + Express · MongoDB

---

## Project Structure

```
orange-falcon-crm/
├── backend/
│   ├── middleware/    auth.js
│   ├── models/        User.js · RFP.js · Call.js · Alert.js
│   ├── routes/        auth.js · rfps.js · calls.js · users.js · alerts.js
│   ├── server.js
│   ├── seed.js        (run once to create admin user)
│   └── .env.example
└── frontend/
    └── src/
        ├── components/  Sidebar · Modal · Button · Badge · Icon
        ├── context/     AuthContext.jsx
        ├── hooks/       useSessionTimer.js
        ├── pages/       Login · Dashboard · RFPs · Calls · Users · Alerts
        └── utils/       api.js (axios instance)
```

---

## Setup

### Prerequisites
- Node.js 18+
- MongoDB (local or MongoDB Atlas)

---

### 1. Backend

```bash
cd backend
npm install

# Copy and fill in env
cp .env.example .env
# Edit .env with your MONGO_URI and JWT_SECRET

# Seed the initial admin user (run once)
node seed.js

# Start dev server
npm run dev
```

Backend runs on **http://localhost:5000**

---

### 2. Frontend

```bash
cd frontend
npm install

# Copy env
cp .env.example .env
# VITE_API_URL=http://localhost:5000/api (already set)

# Start dev server
npm run dev
```

Frontend runs on **http://localhost:5173**

> **Note:** The Vite proxy is configured to forward `/api` requests to the backend automatically in development, so you can also just leave `VITE_API_URL` blank and use the proxy.

---

## Default Login

After running `node seed.js`:

| Field    | Value      |
|----------|------------|
| Username | `aayush`   |
| Password | `admin123` |

⚠️ **Change the password after first login.**

To add more users, log in as admin → go to **Users** → **Add User**.

---

## Features

- **Authentication** — JWT-based login/logout, protected routes
- **Session Timer** — Live timer per user session shown in sidebar
- **Admin Alerts** — Every staff login/logout triggers an alert for admin
- **RFP Tracker** — Client, check-in/out, price, status, notes, priority star
- **Call Log** — Prospect name, phone, outcome, notes
- **Users Panel** — Admin can add/remove users, see online status & session time
- **Role-based access** — Admin-only routes (Users, Alerts)

---

## Deployment

### Backend (e.g. Railway, Render)
- Set `MONGO_URI` to your MongoDB Atlas connection string
- Set `JWT_SECRET` to a strong random string
- Set `CLIENT_URL` to your frontend domain

### Frontend (e.g. Vercel, Netlify)
- Set `VITE_API_URL` to your deployed backend URL + `/api`
- Run `npm run build` → deploy the `dist/` folder

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | Public | Login |
| POST | `/api/auth/logout` | User | Logout |
| GET | `/api/auth/me` | User | Current user |
| GET | `/api/rfps` | User | List RFPs |
| POST | `/api/rfps` | User | Create RFP |
| PUT | `/api/rfps/:id` | User | Update RFP |
| DELETE | `/api/rfps/:id` | User | Delete RFP |
| GET | `/api/calls` | User | List calls |
| POST | `/api/calls` | User | Log call |
| PUT | `/api/calls/:id` | User | Update call |
| DELETE | `/api/calls/:id` | User | Delete call |
| GET | `/api/users` | Admin | List users |
| POST | `/api/users` | Admin | Create user |
| DELETE | `/api/users/:id` | Admin | Delete user |
| GET | `/api/alerts` | Admin | List alerts |
| DELETE | `/api/alerts` | Admin | Clear alerts |
# orangefalcon-crm
# orangefalcon-crm
