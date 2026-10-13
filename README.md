# StayFlow

StayFlow is a hotel management and booking system built as a TypeScript monorepo. It combines a public booking website, a staff dashboard, and a REST + WebSocket API server backed by MongoDB.

## Overview

- **Guest website** (`apps/website`) — browse rooms, check live availability, quote, book and pay, look up bookings, and use a per-stay guest portal (QR code) to message the team.
- **Staff dashboard** (`apps/dashboard`) — front desk (check-in / check-out), reservations, rooms & availability, guests, billing and payments, housekeeping, maintenance, restaurant, inventory, expenses, reports, notifications, website content, and audit logs.
- **API server** (`server`) — Express 5 + MongoDB (Mongoose), Zod validation, JWT auth (cookie refresh), role-based authorization, rate limiting, real-time events via Socket.IO, and Razorpay / Cloudinary / SMTP integrations.

## Tech stack

| Layer      | Technologies |
|------------|--------------|
| Frontend   | React 18, Vite 6, React Router 7, React Query 5, Zustand, react-hook-form + Zod, Tailwind CSS 3, recharts, lucide-react, socket.io-client |
| Backend    | Node.js 20+, Express 5, Mongoose 8, Zod, Socket.IO, JSON Web Tokens |
| Infra      | MongoDB, Vite dev proxy, npm workspaces, vitest, eslint, prettier |

## Repository layout

```
StayFlow/
├── apps/
│   ├── website/      # Public guest website (port 5173)
│   └── dashboard/    # Staff dashboard (port 5174)
├── server/
│   ├── scripts/      # Seed script
│   └── src/
│       ├── config/   # env + database
│       ├── controllers/  # HTTP handlers
│       ├── middleware/   # auth, authorize, audit, rate-limit
│       ├── models/       # Mongoose schemas
│       ├── routes/       # /api/auth, /api/public, /api/admin
│       ├── services/     # business logic (reservations, stays, billing, ops…)
│       ├── types/        # enums + domain types
│       └── utils/        # errors, response, jwt, validation…
├── package.json            # npm workspaces + root scripts
└── tsconfig.base.json      # shared TS compiler options
```

## Prerequisites

- Node.js >= 20
- npm >= 10
- MongoDB running locally (default URI `mongodb://127.0.0.1:27017/stayflow`), or any MongoDB connection string

> For full transactional guarantees (atomic check-in / check-out / booking writes) the code runs MongoDB in a replica set. On a standalone instance the server logs `MongoDB rejected transactions` and falls back to non-transactional writes — double-bookings are still prevented by an atomic room-interval claim.

## Getting started

```bash
# 1. Install dependencies (installs all workspaces)
npm install

# 2. Create environment config
cp .env.example .env
```

Optional: the server also reads `server/.env` if present. The core dev values already have sensible defaults (see `server/src/config/env.ts`), so the app runs without a `.env` file.

```bash
# 3. Seed the database with demo data
npm run seed

# 4. Start everything (server + website + dashboard)
npm run dev
```

The development environment starts on port 4000 (`/api`), proxy paths:

| App       | URL                          |
|-----------|------------------------------|
| API       | http://localhost:4000        |
| Website   | http://localhost:5173        |
| Dashboard | http://localhost:5174        |

### Demo logins

| Role        | Email                            |
|-------------|----------------------------------|
| Owner       | `owner@stayflow.local`           |
| Manager     | `manager@stayflow.local`         |
| Reception   | `reception@stayflow.local`       |
| Housekeeping| `housekeeping@stayflow.local`    |
| Restaurant  | `restaurant@stayflow.local`      |
| Maintenance | `maintenance@stayflow.local`     |
| Accountant  | `accounts@stayflow.local`        |

All role passwords are `StayFlow!2026`.

## Scripts (run from the repo root)

```bash
npm run dev         # start server, website, and dashboard concurrently
npm run build       # type-check and build all workspaces
npm run lint        # lint all workspaces
npm run typecheck   # type-check all workspaces
npm run test        # run the server test suite (vitest)
npm run seed        # reset and seed the development database
npm run format      # prettier --write .
npm run format:check# prettier --check .
```

You can scope any workspace script with `--workspace`:

```bash
npm run dev --workspace server
npm run test --workspace server
npm run typecheck --workspace apps/dashboard
```

## API surface

The server exposes three route groups under `/api`:

### `/api/auth`
`POST /login`, `POST /refresh`, `POST /logout`, `GET /me`, `POST /forgot-password`, `POST /reset-password` (login/refresh rate-limited).

### `/api/public`
Open, unauthenticated endpoints used by the website:

- `GET /hotel`, `GET /rooms`, `GET /rooms/:id`
- `POST /availability`, `POST /quote`
- `POST /bookings`, `POST /payments/confirm`, `POST /bookings/lookup`
- `GET /offers`, `GET /facilities`, `GET /gallery`, `POST /contact`
- `GET /guest-portal/:token`, `POST /guest-portal/:token/services`

### `/api/admin`
Authenticated + role-authorized endpoints for the dashboard:

- Dashboard / reporting: `GET /dashboard/overview`, `GET /reports`, `POST /availability`
- Rooms: `GET/POST /rooms`, `PATCH /rooms/:id/status`, `GET/POST /room-types`, `PATCH /room-types/:id`, `GET/POST /rates`, `DELETE /rates/:id`, `POST /rates/clear`
- Reservations: `GET/POST /reservations`, `GET /reservations/:id`, `POST /reservations/:id/cancel|extend|change-room`, `PATCH /reservations/:id/status`
- Front desk: `POST /check-in`, `POST /check-out`, `GET /stays`
- Guests: `GET/POST /guests`, `GET/PATCH /guests/:id`
- Billing: `GET/POST /payments`, `GET /invoices`, `GET /invoices/:id`
- Operations: housekeeping, maintenance, services, restaurant menu/orders, inventory, expenses
- Content & admin: `GET/PUT /website`, `GET /notifications`, `GET/POST /staff`, `GET /search`, `GET /audit-logs`, `POST /uploads/images`

### Role-based access

`/api/admin` routes are guarded with a role allow-list. Roughly:

- **Management** (owner, manager) — full access including room types, website content, staff, audit logs, uploads.
- **Front desk** (owner, manager, reception, accountant) — bookings, guests, billing, check-in / check-out.
- **Operations** (housekeeping, maintenance, restaurant, plus reception) — rooms, housekeeping, maintenance, orders, services.
- **Accountant** additionally sees expenses, inventory, and reports.

## Environment variables

| Variable               | Default                                            | Description                         |
|------------------------|----------------------------------------------------|-------------------------------------|
| `NODE_ENV`             | `development`                                      | `development` / `test` / `production` |
| `PORT`                 | `4000`                                             | API port                            |
| `MONGODB_URI`          | `mongodb://127.0.0.1:27017/stayflow`               | MongoDB connection string           |
| `JWT_ACCESS_SECRET`    | dev default                                        | Access-token signing secret         |
| `JWT_REFRESH_SECRET`   | dev default                                        | Refresh-token signing secret        |
| `JWT_ACCESS_TTL`       | `15m`                                              | Access token lifetime               |
| `JWT_REFRESH_TTL_DAYS` | `30`                                               | Refresh token lifetime (days)       |
| `RAZORPAY_KEY_ID`      | —                                                  | Razorpay payment integration        |
| `RAZORPAY_KEY_SECRET`  | —                                                  | Razorpay payment integration        |
| `CLOUDINARY_*`         | —                                                  | Image uploads                        |
| `SMTP_*`               | `no-reply@example.com`                             | Email (reset passwords, enquiries)  |
| `CLIENT_URL`           | `http://localhost:5173`                            | Website origin (guest QR links, CORS) |
| `DASHBOARD_URL`        | `http://localhost:5174`                            | Dashboard origin (CORS)             |
| `WEB_ORIGINS`          | `http://localhost:5173,http://localhost:5174`      | Allowed CORS origins                |

In production the server refuses to start with weak or shared JWT secrets or the default local MongoDB URI (see `server/src/config/env.ts`).

## Testing

```bash
npm test            # runs the server suite (vitest + mongodb-memory-server)
```

The suite covers availability/intervals, concurrent booking stock claims, pricing, invoicing/payments, check-in / check-out lifecycles (including early checkout releasing room availability), guest portal requests, and report accuracy.

## Notes

- The room-inventory status model: `available`, `reserved`, `occupied`, `dirty`, `cleaning`, `maintenance`, `out_of_service`.
- Availability is backed by per-room `reservedIntervals` and cross-checked against live reservations, so cancelled, checked-out, and no-show bookings free the room immediately.
- `npm run seed` **deletes all existing data** before inserting demo content — never run it against a production database (it refuses when `NODE_ENV=production`).#   S t a y F l o w  
 