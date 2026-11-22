# Deploy & Git Guide (step by step)

## A. Run it on your PC first (VS Code / Antigravity)

1. Unzip `ticketflow` somewhere, open the folder in VS Code / Antigravity.
2. Open the terminal (`` Ctrl + ` ``) in the `ticketflow` folder:
   ```bash
   npm install
   npm run install:all
   npm run seed
   npm run dev
   ```
3. Open http://localhost:5173 and click **Demo Customer** on the login page.

`server/.env` and `client/.env` are already filled in for local use. They are git-ignored, so they will **not** be pushed.

> If `npm run seed` says it cannot connect: MongoDB Atlas → **Network Access** → **Add IP Address** → **Allow access from anywhere (0.0.0.0/0)**. Render also needs this.

## B. Put it on GitHub with a real branch / PR history

The reviewers want small commits over several days, feature branches and PRs. Do **not** push everything in one commit.

1. Create an empty **public** repo on GitHub called `ticketflow` (no README).
2. First commit on `main` = only the skeleton:
   ```bash
   git init -b main
   git add .gitignore package.json README.md server/package.json server/package-lock.json server/.env.example server/.gitignore server/eslint.config.js client/package.json client/package-lock.json client/.env.example client/.gitignore
   git commit -m "chore: initial project skeleton"
   git remote add origin https://github.com/<you>/ticketflow.git
   git push -u origin main
   ```
3. In GitHub → Settings → Branches → add a rule for `main`: **Require a pull request before merging** and **Require status checks to pass**.
4. For every feature: create a branch, add the related files, commit, push, open a PR, wait for CI to go green, merge. Suggested order (spread over your build days, and read each part while you commit it, because you will have to explain it):

| Branch | Files to add | Commit message(s) |
|---|---|---|
| `feature/config-and-db` | `server/src/config/*`, `server/src/utils/*`, `server/src/app.js`, `server/src/server.js`, error/validate middleware | `feat: add env config, logger and MongoDB connection` · `feat: add central error handling and validation middleware` |
| `feature/auth-rbac` | User model/repo, AuthService, auth middleware, auth controller/routes | `feat: add JWT auth with organizer and customer roles` |
| `feature/event-management` | Event + Seat models/repos, EventService, schemas, event routes | `feat: add event CRUD with seat map and categories` · `feat: restrict event management to owner` |
| `feature/browse-events` | search in EventRepository, cache | `feat: add event search, filters and pagination` · `perf: cache event list` |
| `feature/booking-state-machine` | `domain/booking/*`, Booking model/repo | `feat: add booking state machine with status history` · `test: add booking status transition tests` |
| `feature/seat-hold` | holdSeats in BookingService, HoldExpiryService | `feat: add seat hold with auto-expiry` · `fix: prevent double booking on concurrent requests` · `test: add hold expiry tests` |
| `feature/pricing-strategies` | `domain/pricing/*` | `feat: add base and early-bird pricing strategies` · `test: add pricing strategy tests` |
| `feature/payments` | `payments/*`, Payment model/repo, pay endpoint | `feat: add bKash and card mock payment providers` · `feat: make payments idempotent` · `feat: add Nagad provider` |
| `feature/refunds` | RefundPolicy, cancel flow | `feat: add cancellation with 24h refund rule` · `test: add refund rule unit tests` |
| `feature/notifications` | `notifications/*`, eventBus, Notification model | `feat: add email and in-app notifications via event bus` |
| `feature/realtime` | `realtime/*` | `feat: push live seat map updates over websockets` |
| `feature/security` | rateLimiters, helmet/cors/sanitize in app.js | `feat: add rate limiting and security middleware` |
| `feature/frontend-*` | client files, in 3–4 PRs (browse, seat map + checkout, bookings, organizer dashboard) | `feat(client): ...` |
| `ci/github-actions` | `.github/workflows/ci-cd.yml`, `render.yaml`, `client/vercel.json` | `ci: run lint, build and tests with coverage` · `ci: deploy on merge to main` |
| `docs/readme-architecture` | README, ARCHITECTURE, AI_USAGE | `docs: add architecture and setup docs` |

   Per branch:
   ```bash
   git checkout main && git pull
   git checkout -b feature/seat-hold
   git add <files>
   git commit -m "feat: add seat hold with auto-expiry"
   git push -u origin feature/seat-hold
   # open the PR on GitHub (or: gh pr create --fill), merge when CI is green
   ```
   Check nothing is left: `git status` should be clean at the end.

## C. Backend on Render

1. render.com → **New → Web Service** → connect the GitHub repo.
2. **Root Directory**: `server` · **Build**: `npm ci` · **Start**: `npm start` · **Instance**: Free.
3. **Environment** variables (copy values from your local `server/.env`, but use a NEW random `JWT_SECRET`):
   `NODE_ENV=production`, `MONGODB_URI`, `DB_NAME=CPS_Pro`, `COLLECTION_PREFIX=TicketFlow`, `JWT_SECRET`, `CLOUDINARY_URL`, `CLOUDINARY_FOLDER=CPS_Project`, `CLIENT_URL=https://<your-app>.vercel.app` (fill after step D; comma-separate several URLs).
4. Settings → **Health Check Path** `/api/health`. **Auto-Deploy: No** (GitHub Actions deploys after CI passes).
5. Settings → **Deploy Hook** → copy the URL.
6. After the first deploy, open `https://<your-api>.onrender.com/api/health`. It should show `"db":"up"`.

## D. Frontend on Vercel

1. vercel.com → **Add New Project** → import the repo.
2. **Root Directory**: `client` · Framework: **Vite** (auto).
3. Environment variable: `VITE_API_URL=https://<your-api>.onrender.com/api`
4. Deploy. Put the Vercel URL into Render's `CLIENT_URL` and redeploy Render.

Vercel's Git integration deploys `main` automatically on every merge (and gives preview URLs for PRs).

## E. CD secrets in GitHub

Repo → Settings → Secrets and variables → Actions → **New repository secret**:

* `RENDER_DEPLOY_HOOK_URL`: the URL from C.5
* `VERCEL_DEPLOY_HOOK_URL` (optional): Vercel → Project → Settings → Git → Deploy Hooks (branch `main`)

From now on: PR → CI (lint + build + tests + coverage) → merge to `main` → CI again → deploy job triggers Render (and Vercel).

## F. Keep it live for the review

* Render free instances sleep after ~15 min idle (first request then takes ~50 s). Create a free monitor on **UptimeRobot** or **cron-job.org** that calls `https://<your-api>.onrender.com/api/health` every 5 minutes.
* Run the concurrency test against the live API once and keep the output for your video:
  ```bash
  cd server
  API_URL=https://<your-api>.onrender.com/api npm run test:concurrency
  ```
  On Windows PowerShell: `$env:API_URL="https://<your-api>.onrender.com/api"; npm run test:concurrency`
* Update the README: live URLs and your GitHub username in the CI badge.

## G. Security note

The MongoDB password and Cloudinary secret were written in the brief document. Before you submit, it is safer to **rotate them** (Atlas → Database Access → edit user → new password; Cloudinary → API Keys → regenerate) and update `server/.env` + Render env vars. Never commit `.env`.
