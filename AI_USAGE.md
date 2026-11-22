# AI Usage

> Be honest here. Edit this file so it describes exactly what you did.

## Tools used

* **Claude (Anthropic)**: generated the initial project from my written requirements (the InterviewQuest brief).
* <!-- add any others: GitHub Copilot, ChatGPT, Antigravity agent, etc. -->

## What AI did

* Proposed the architecture (layers, repositories, composition root) and the design patterns.
* Generated the first version of the backend (Express, Mongoose models, services, payment/notification abstractions, state machine), the React frontend, unit tests, CI/CD workflow and these docs.
* Explained the double-booking strategy (atomic conditional updates) and idempotent payments.

## What I did myself

<!-- Fill this in honestly. Examples: -->
* Wrote the requirements and chose the stack (MERN, Vercel + Render, MongoDB Atlas, Cloudinary).
* Read and walked through every file until I could explain it; <!-- list anything you changed -->
* Set up MongoDB Atlas, Cloudinary, Render, Vercel, GitHub secrets and the deploy hooks.
* Built the project feature by feature on separate branches with pull requests.
* Tested the flows manually (two browsers racing for one seat, payment failure/retry, expiry, refunds) and ran the concurrency test against the live API.
* <!-- bugs you found/fixed, UI changes, extra tests you added -->

## How I verified AI output

* Ran `npm test` (unit tests for state machine, pricing, hold expiry, refund rule, idempotent payments, concurrency) and the lint/build in CI.
* Ran `scripts/concurrency-test.js` against the deployed API.
