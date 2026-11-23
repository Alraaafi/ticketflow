# 🎟️ TicketFlow

[![CI / CD](https://github.com/<your-github-username>/ticketflow/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/<your-github-username>/ticketflow/actions/workflows/ci-cd.yml)

Seat booking system (like Ticketmaster / BookMyShow), built for Bangladesh: **concerts, bus & train seats, resort rooms, sports, theatre and conferences**.
Organizers build seat maps with priced categories. Customers browse, **hold seats for 5 minutes**, pay with **bKash / Nagad / Card (mock)** and get notified.

| | URL |
|---|---|
| Frontend (Vercel) | `https://ticketflow-pi-beige.vercel.app` |
| Backend API (Render) | `https://ticketflow-vn61.onrender.com/api` |
| Health check | `https://ticketflow-vn61.onrender.com/api/health` |

### Demo credentials

| Role | Email | Password |
|---|---|---|
| Organizer | `organizer@ticketflow.com` | `Organizer@123` |
| Customer | `customer@ticketflow.com` | `Customer@123` |
| Customer 2 (to test two users) | `customer2@ticketflow.com` | `Customer@123` |
| Organizer 2 (to test ownership rules) | `organizer2@ticketflow.com` | `Organizer@123` |

Test payments: bKash `01712345678` succeeds, `01700000000` fails. Card `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined.

---

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS v4, React Router, **Zustand** (state), Axios, **Framer Motion** (animations), **react-hot-toast** (toasts), Socket.IO client, Lucide icons |
| Backend | Node.js, **Express**, **MongoDB Atlas + Mongoose**, Socket.IO, JWT, bcrypt, **zod** validation, pino logging |
| Security | helmet, CORS allow-list, express-rate-limit, express-mongo-sanitize (NoSQL injection), hpp, JSON body limit, secrets only in env vars |
| Media | Cloudinary (event cover images) |
| Quality | Jest (84 unit tests + coverage), ESLint, GitHub Actions CI/CD |

Why Express and not Next.js: the brief wants a 2-tier app (client on Vercel, server on Render). A separate Express API gives us a long-running process for **WebSockets** and the **background hold-expiry job**, which serverless Next.js routes cannot keep alive.

## Features

| # | Feature | Where |
|---|---|---|
| 1 | JWT auth + roles (Organizer / Customer), RBAC middleware | `server/src/middlewares/auth.js` |
| 2 | Event management, seat map rows × seats, categories with prices, owner-only edits | `services/EventService.js` |
| 3 | Browse: search by name, city, date range, type, pagination (cached) | `repositories/EventRepository.js` |
| 4 | Seat hold (5 min), auto-release on expiry | `SeatRepository.holdSeat`, `services/HoldExpiryService.js` |
| 5 | Booking lifecycle with state machine + status history | `domain/booking/bookingStateMachine.js` |
| 6 | 3 mock payment providers behind one interface, idempotent | `payments/` |
| 7 | Pricing strategies: Base, Early-bird (chosen per event) | `domain/pricing/` |
| 8 | Notifications: email (log) + in-app (DB + live socket) | `notifications/` |
| 9 | No double booking under concurrency | atomic `findOneAndUpdate` on seat status |
| 10 | Cancellation with refund rule (>24h = full, else none) | `domain/refund/RefundPolicy.js` |
| 11 | Validation (zod), central error handler, logging (pino), env config | `validators/`, `middlewares/errorHandler.js`, `config/env.js` |
| Bonus | Real-time seat map (Socket.IO), event-list caching (memory or Redis), rate-limit on booking, concurrency/load test | `realtime/`, `cache/`, `rateLimiters.js`, `scripts/concurrency-test.js` |

## Run locally

Requirements: **Node.js 20+**.

```bash
# 1. install everything (root, server, client)
npm install
npm run install:all

# 2. create env files
cp server/.env.example server/.env      # then fill in MONGODB_URI, JWT_SECRET, CLOUDINARY_URL
cp client/.env.example client/.env      # VITE_API_URL=http://localhost:5000/api

# 3. seed demo users + 7 demo events
npm run seed                            # add  -- --reset  to wipe and recreate

# 4. start API (:5000) and web app (:5173) together
npm run dev
```

Open http://localhost:5173

Other commands:

```bash
npm test                                   # server unit tests
npm run test:coverage --prefix server      # coverage report in server/coverage
npm run lint                               # lint server + client
# Concurrency test: 20 customers grab the same seat at the same time, exactly 1 must win
API_URL=http://localhost:5000/api npm run test:concurrency --prefix server
```

## API overview

All responses: `{ success: true, data }` or `{ success: false, error: { code, message, details } }`.

| Method | Path | Who |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | public |
| GET | `/api/auth/me` | logged in |
| GET | `/api/events?q=&city=&type=&from=&to=&page=&limit=` | public |
| GET | `/api/events/:id`, `/api/events/:id/seats` | public |
| POST | `/api/events/:id/quote` `{ seats }` | public |
| POST / PATCH / DELETE | `/api/events`, `/api/events/:id` | organizer (own events) |
| POST | `/api/events/:id/image` (multipart `image`) | organizer (own events) |
| GET | `/api/organizer/events`, `/api/organizer/events/:id` | organizer |
| POST | `/api/bookings/hold` `{ eventId, seats }` | customer |
| POST | `/api/bookings/:id/checkout` | customer |
| POST | `/api/bookings/:id/pay` + header `Idempotency-Key` | customer |
| POST | `/api/bookings/:id/cancel`, GET `/api/bookings/:id/refund-preview` | customer |
| GET | `/api/bookings`, `/api/bookings/:id` | customer / event organizer |
| GET / PATCH | `/api/notifications`, `/api/notifications/read-all` | logged in |
| GET | `/api/payments/providers`, `/api/health` | public |

## Project structure

```
ticketflow/
├─ server/              Express API (deployed to Render)
│  ├─ src/
│  │  ├─ config/        env (zod-validated), db, logger, cloudinary
│  │  ├─ domain/        pure business rules: state machine, pricing, refund, hold policy
│  │  ├─ models/        Mongoose schemas
│  │  ├─ repositories/  all DB access
│  │  ├─ services/      use cases (Auth, Event, Booking, HoldExpiry)
│  │  ├─ payments/      PaymentService + provider interface + bKash/Nagad/Card mocks
│  │  ├─ notifications/ NotificationService + Email/In-app channels
│  │  ├─ events/        domain event bus (observer)
│  │  ├─ controllers/ routes/ middlewares/ validators/
│  │  ├─ realtime/      Socket.IO
│  │  ├─ cache/         Memory / Redis cache
│  │  ├─ container.js   composition root (dependency injection)
│  │  ├─ app.js         express app
│  │  └─ server.js      entry point
│  ├─ tests/unit/       Jest tests
│  └─ scripts/          seed + concurrency test
├─ client/              React app (deployed to Vercel)
└─ .github/workflows/   CI/CD
```

More: [ARCHITECTURE.md](ARCHITECTURE.md) · [AI_USAGE.md](AI_USAGE.md) · [DEPLOY_AND_GIT_GUIDE.md](DEPLOY_AND_GIT_GUIDE.md)

## Declaration

"I understand all of my code and can extend it live."
