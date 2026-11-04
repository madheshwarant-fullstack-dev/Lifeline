# Lifeline – Blood Donation & Emergency Coordination Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.162-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.14-blue.svg?logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React-19.2-61dafb.svg?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB%20Atlas-Cloud%20Database-47A248.svg?logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-grade healthcare web application engineered to eliminate fatal delays during acute blood shortages. **Lifeline** connects compatible voluntary blood donors, patients in need, and accredited healthcare institutions in real-time, featuring high-priority emergency notifications, serological compatibility matching, and comprehensive administrative telemetry.

---

## 📑 Table of Contents
1. [Project Overview](#-project-overview)
2. [Key Features](#-key-features)
3. [Technology Stack](#-technology-stack)
4. [System Architecture](#-system-architecture)
5. [Folder Structure](#-folder-structure)
6. [MongoDB Atlas Database Architecture](#-mongodb-atlas-database-architecture)
7. [Environment Variables](#-environment-variables)
8. [Installation & Local Setup](#-installation--local-setup)
9. [API Documentation & Swagger UI](#-api-documentation--swagger-ui)
10. [Production Deployment Guide](#-production-deployment-guide)
    - [Deploy Backend to Render](#1-deploy-backend-to-render)
    - [Deploy Frontend to Vercel](#2-deploy-frontend-to-vercel)
11. [Pre-configured Demo Credentials](#-pre-configured-demo-credentials)
12. [Compliance & Medical Disclaimer](#-compliance--medical-disclaimer)

---

## 🎯 Project Overview
During medical trauma, organ transplants, and surgical emergencies, locating matching red blood cell units within tight therapeutic windows often determines patient survival. Traditional coordination relies on unstructured messaging with no serological verification.

**Lifeline** provides:
- Automated serological compatibility checking for all ABO and Rh blood groups.
- Candidate donor ranking based on proximity, verification status, and mandatory 90-day cooldown safety intervals.
- Instantaneous push and alert dispatching for urgent emergency requests.
- Administrative verification registry, user management, and operational analytics.

---

## 🚀 Key Features

### 🩸 Public Portal & Educational Resources
- **Compatibility Checker:** Real-time compatibility verification for all 8 blood groups (O-, O+, A-, A+, B-, B+, AB-, AB+).
- **Live Emergency Queue:** Highlights acute trauma requests requiring urgent voluntary donation.
- **Transfusion Guides:** Clinical breakdown of red cell compatibility, plasma utility, and donor eligibility guidelines.

### 🧑‍⚕️ Donor Portal
- **Dashboard Telemetry:** Blood group badge, 90-day cooldown countdown, and lifetime donation counter.
- **Availability Toggle:** 1-click status switch between `Available` and `Unavailable`.
- **Request Coordination:** Review incoming matched requests with 1-click **Accept** or **Decline**.
- **Donation History & Medical Screenings:** Verifiable record of completed transfusions and digital health eligibility questionnaires.
- **Notification Center:** Unread badge counter, filtering, and alert resolution.

### 🏥 Blood Requester & Hospital Module
- **Intuitive Request Generator:** Captures patient identity, blood type, units required, hospital address, required date, and urgency level (`LOW`, `NORMAL`, `HIGH`, `EMERGENCY`).
- **Emergency Priority Highlighting:** Visual warning badges and instant dispatch to verified regional donors.
- **Ranked Match Results:** Percentage score, compatibility classification, and donor contact coordination.
- **Status Lifecycle Tracker:** Visual 6-step progress tracking from request creation to completion.

### 🛡️ Administrative Console
- **Platform KPIs:** Live counts of Users, Registered Donors, Active Donors, Total Requests, Emergencies, Completed Transfusions, and Hospitals.
- **Interactive Analytics:** Blood group distribution charts, urgency breakdown graphs, and metropolitan donor densities.
- **User Account Management:** Search, filter by role/blood group, toggle account suspension (`ACTIVE` / `BLOCKED`), or delete records.
- **Donor Verification Registry:** Admin screening of donors with `PENDING`, `VERIFIED`, or `REJECTED` badges.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, JavaScript (ES6+), Vite 8.3, Bootstrap 5.3, React Router DOM v7, Axios, React Icons, Chart.js |
| **Backend** | Python 3.14 / 3.11+, FastAPI, Uvicorn, Pydantic V2, PyJWT, bcrypt, python-dotenv |
| **Database** | MongoDB Atlas (Cloud Cluster), PyMongo, BSON ObjectId |
| **Deployment** | Vercel (Frontend SPA), Render (FastAPI Web Service), MongoDB Atlas (Cloud Database) |

---

## 🏗️ System Architecture

```
[ Web Browser Client (React + Vite) ]
        │
        │ HTTPS / REST (JWT in Authorization Bearer Header)
        ▼
[ FastAPI Backend Service (Uvicorn / Port 5000) ]
        ├── Lifespan Event Handlers (Atlas Connection & Index Verification)
        ├── CORS Middleware (Localhost + *.vercel.app Production Domains)
        ├── Dependency Injection (get_current_user, require_role)
        ├── Pydantic V2 Validation Schemas
        └── Route Handlers (/api/auth, /api/donors, /api/requests, etc.)
        │
        ▼
[ PyMongo Connection Pool with TLS / Certifi ]
        │
        ▼
[ MongoDB Atlas Cloud Cluster ('lifeline' database) ]
  (users, donors, blood_requests, donations, hospitals, notifications, admin_logs, health_screenings)
```

---

## 📂 Folder Structure

```
Lifeline/
├── frontend/                     # React Vite Single-Page Application
│   ├── public/                   # Static assets & favicon
│   ├── src/
│   │   ├── components/           # Reusable UI components & layouts
│   │   ├── pages/                # Public, Donor, Requester, and Admin pages
│   │   ├── services/             # Axios API client & endpoint services
│   │   ├── App.jsx               # Client routing & protected routes
│   │   └── main.jsx              # React DOM entry point
│   ├── .env.example              # Frontend environment template
│   ├── vercel.json               # Vercel SPA routing configuration
│   ├── package.json              # NPM dependencies & build scripts
│   └── vite.config.js            # Vite configuration
│
├── backend/                      # Python FastAPI REST API Backend
│   ├── main.py                   # FastAPI Application Entry Point & Routes
│   ├── config.py                 # Configuration loader & environment variables
│   ├── models/                   # Pydantic V2 request & validation schemas
│   ├── database/
│   │   ├── connection.py         # PyMongo Atlas connection pool & lifecycle
│   │   └── seed_data.py          # Clinical seed data & migrations
│   ├── middleware/               # Auth token verification & role decorators
│   ├── routes/                   # Route controllers
│   ├── services/                 # Modular business services
│   ├── tests/                    # Automated integration & endpoint test suite
│   ├── requirements.txt          # Python dependencies
│   ├── .env                      # Active environment configuration (gitignored)
│   └── .env.example              # Sanitized environment template
│
├── render.yaml                   # Render Blueprint Infrastructure-as-Code
├── .gitignore                    # Comprehensive secrets & build exclusions
├── .env.example                  # Root environment reference template
└── README.md                     # Project documentation
```

---

## 🗄️ MongoDB Atlas Database Architecture

The application connects to the `lifeline` database on MongoDB Atlas.

### Collections & Indexes:
1. **`users`**
   - Fields: `name`, `email`, `phone`, `password` (bcrypt hash), `role` (`DONOR` | `REQUESTER` | `HOSPITAL` | `ADMIN`), `city`, `state`, `status` (`ACTIVE` | `BLOCKED`).
   - Indexes: Unique on `email`, single indexes on `role`, `status`, `city`, `state`.
2. **`donors`**
   - Fields: `userId`, `name`, `bloodGroup`, `city`, `state`, `availability` (boolean), `verificationStatus` (`VERIFIED` | `PENDING` | `REJECTED`), `totalDonations`, `lastDonationDate`.
   - Indexes: Unique on `userId`, compound indexes on `(bloodGroup, city, availability)` and `(bloodGroup, state, availability)`.
3. **`blood_requests`**
   - Fields: `requesterId`, `patientName`, `bloodGroup`, `unitsRequired`, `hospitalName`, `city`, `state`, `urgency` (`LOW` | `NORMAL` | `HIGH` | `EMERGENCY`), `status` (`OPEN` | `MATCHED` | `DONOR_CONTACTED` | `SCHEDULED` | `DONATION_COMPLETED` | `CLOSED` | `CANCELLED`).
   - Indexes: `bloodGroup`, `city`, `state`, `urgency`, `status`, `requesterId`, `createdAt`.
4. **`donations`**
   - Fields: `donationId`, `donorId`, `requestId`, `units`, `hospitalName`, `donationDate`, `status` (`COMPLETED` | `SCHEDULED` | `CANCELLED`).
   - Indexes: Unique on `donationId`, `donorId`, `requestId`, `status`, `donationDate`.
5. **`hospitals`**
   - Fields: `userId`, `hospitalName`, `representativeName`, `registrationNumber`, `city`, `state`, `isVerified`.
   - Indexes: Unique on `userId`, `city`, `state`.
6. **`notifications`**
   - Fields: `recipientId`, `title`, `message`, `notif_type`, `isRead`, `createdAt`.
   - Indexes: `(recipientId, createdAt)`, `(recipientId, isRead)`.
7. **`admin_logs`**
   - Fields: `adminId`, `action`, `targetUserId`, `details`, `createdAt`.
8. **`health_screenings`**
   - Fields: `requestId`, `donorId`, `weightKg`, `hemoglobin`, `answers`, `status` (`PENDING` | `APPROVED` | `REJECTED`).

---

## 🔐 Environment Variables

### Backend (`backend/.env`):
```env
PORT=5000
FASTAPI_ENV=development

# MongoDB Atlas Cloud URI
MONGO_URI=mongodb+srv://<username>:<password>@lifeline.hpq3jzn.mongodb.net/lifeline?retryWrites=true&w=majority
DB_NAME=lifeline

# JWT Security
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=86400

# CORS Allowed Origin (Localhost or Deployed Vercel URL)
FRONTEND_URL=http://localhost:5173

# Email Notifications (Optional for development - falls back to terminal logging)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_DEFAULT_SENDER=noreply@lifeline.org
```

### Frontend (`frontend/.env`):
```env
# Local development:
VITE_API_BASE_URL=http://localhost:5000/api

# In production on Vercel:
# VITE_API_BASE_URL=https://<your-backend-name>.onrender.com/api
```

---

## 💻 Installation & Local Setup

### Prerequisites
- Node.js (v18 or later)
- Python (v3.10 or later)
- Access to MongoDB Atlas (with current IP whitelisted under Network Access)

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd Lifeline
```

### 2. Backend Setup
```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env with your MongoDB Atlas credentials and JWT Secret
```

Run the FastAPI backend:
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```
The API is now running at `http://localhost:5000/api` with interactive Swagger docs at `http://localhost:5000/docs`.

### 3. Frontend Setup
In a new terminal window:
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
The React frontend is now accessible at `http://localhost:5173`.

### 4. Run Automated Test Suite
```bash
backend\.venv\Scripts\python.exe backend/tests/test_fastapi_endpoints.py
```

---

## 📖 API Documentation & Swagger UI

FastAPI provides automated, interactive API documentation out of the box:
- **Swagger UI**: [`http://localhost:5000/docs`](http://localhost:5000/docs)
- **ReDoc**: [`http://localhost:5000/redoc`](http://localhost:5000/redoc)
- **OpenAPI Schema**: [`http://localhost:5000/openapi.json`](http://localhost:5000/openapi.json)

### Primary API Routes:
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/health` | Service & Database health check | Public |
| `GET` | `/api/stats` | Platform statistics & metrics | Public |
| `POST` | `/api/auth/register` | User / Donor / Hospital registration | Public |
| `POST` | `/api/auth/login` | User authentication & JWT issuance | Public |
| `GET` | `/api/auth/me` | Authenticated profile retrieval | Authenticated |
| `GET` | `/api/donors` | List & filter voluntary donors | Public |
| `GET` | `/api/donors/dashboard` | Donor personal statistics | Donor |
| `POST` | `/api/donors/availability` | Toggle donor availability | Donor |
| `POST` | `/api/requests` | Create emergency blood request | Authenticated |
| `GET` | `/api/requests` | List blood requests with filters | Public |
| `GET` | `/api/matching/{id}` | Serological compatibility matching | Public / Auth |
| `GET` | `/api/admin/dashboard` | Administrative Cockpit analytics | Admin Only |
| `GET` | `/api/admin/users` | Manage registered accounts | Admin Only |
| `PUT` | `/api/admin/donors/{id}/verify`| Verify voluntary donor profile | Admin Only |

---

## 🚀 Production Deployment Guide

### 1. Deploy Backend to Render
1. Create a free account at [render.com](https://render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository.
4. Configure service settings:
   - **Name**: `lifeline-api`
   - **Region**: Closest to your MongoDB Atlas cluster
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. In **Environment Variables**, add:
   - `MONGO_URI`: `mongodb+srv://<username>:<password>@lifeline.hpq3jzn.mongodb.net/lifeline?retryWrites=true&w=majority`
   - `DB_NAME`: `lifeline`
   - `JWT_SECRET`: `<your-secure-production-jwt-secret>`
   - `JWT_EXPIRES_IN`: `86400`
   - `FRONTEND_URL`: `https://<your-vercel-domain>.vercel.app`
6. Click **Deploy Web Service**.
7. Copy the public Render service URL: `https://<your-app-name>.onrender.com`.

### 2. Deploy Frontend to Vercel
1. Create an account at [vercel.com](https://vercel.com).
2. Click **Add New...** → **Project** and import your GitHub repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Under **Environment Variables**, add:
   - `VITE_API_BASE_URL`: `https://<your-app-name>.onrender.com/api`
5. Click **Deploy**.
6. When deployment finishes, copy your live Vercel URL: `https://<your-app-name>.vercel.app`.

---

## 🔑 Pre-configured Demo Credentials

| Role | Email | Password | Permissions |
|---|---|---|---|
| **System Administrator** | `admin@bloodconnect.org` | `AdminPassword123!` | Full admin console, verifications, analytics |
| **Demo Donor** | `donor@bloodconnect.org` | `DonorPassword123!` | Donor dashboard, accept/decline requests |
| **Demo Requester** | `requester@bloodconnect.org` | `RequesterPassword123!` | Create & manage emergency blood requests |

---

## ⚖️ Compliance & Medical Disclaimer

> [!WARNING]
> **Clinical Notice**: Lifeline is a donor coordination platform and algorithmic decision-support tool. It does not replace certified clinical blood banking protocols. All donor eligibility, blood typing, crossmatching, and infectious disease screening must be clinically verified by licensed medical professionals and certified blood bank facilities before transfusion.
