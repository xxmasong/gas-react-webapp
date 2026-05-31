# GAS React Web App

A Google Apps Script **web app** with a **React (Vite)** frontend and **Google
Sheets as the backend**. The UI bundles into a single HTML file that Apps Script
serves from `doGet()`; the browser talks to the server via `google.script.run`
(wrapped as typed promises by `gas-client`).

## Stack

- **React 18 + Vite 5** — frontend, inlined to one self-contained file via `vite-plugin-singlefile`.
- **gas-client** — promise-based wrapper over `google.script.run`.
- **Google Sheets** — the database (a tab named `Items`).
- **clasp** — pushes/deploys to Apps Script.
- **TypeScript** — the client↔server contract (`src/shared/types.ts`).

## Quick start

```bash
npm install
npm run login            # authenticate clasp with your Google account (once per machine)
npm run setup            # create the Sheets-bound Apps Script project (writes .clasp.json)
npm run deploy:version   # build, push, and cut the first web-app deployment (gives the /exec URL)
```

Then develop locally and ship:

```bash
npm run dev              # local Vite server + HMR (runs against an in-memory MOCK backend)
npm run deploy           # build + push; updates the live web app in place
```

The dev server can't reach Apps Script, so it uses a mock that mirrors the server
API — the header badge shows `local mock` vs `Sheets backend`. Prerequisites:
Node 18+ and the Apps Script API enabled once at
<https://script.google.com/home/usersettings>.

## Documentation

| Doc | For |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, GAS constraints, decisions (ADRs). |
| [docs/PROJECT_LAYOUT.md](docs/PROJECT_LAYOUT.md) | Canonical file tree + authoritative configs — the **reproduction spec**. |
| [docs/BUSINESS_LOGIC.md](docs/BUSINESS_LOGIC.md) | Exact per-layer / per-operation business + modular logic. |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local dev loop, mock backend, conventions. |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Add or change a feature, end to end. |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Google Sheets as the database. |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Build, push, version, roll back. |
| [docs/FRONTEND_GUIDELINES.md](docs/FRONTEND_GUIDELINES.md) | Component structure, design system, responsive design, hooks, context. |
| [docs/BACKEND_GUIDELINES.md](docs/BACKEND_GUIDELINES.md) | Layer architecture, services, repositories, mappers, lib utilities, locking, caching. |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | GAS-specific failure modes. |
| [docs/DEPLOY_URL.md](docs/DEPLOY_URL.md) | Live script/sheet IDs and `/exec` URLs. |

> **Recreating this project from scratch (human or AI)?** Read
> [docs/PROJECT_LAYOUT.md](docs/PROJECT_LAYOUT.md) (file tree + exact configs) and
> [docs/BUSINESS_LOGIC.md](docs/BUSINESS_LOGIC.md) (exact per-layer logic) together —
> they are written to be sufficient to reproduce the tree and behavior exactly.

> `KNOWLEDGE.md` is an internal context cache for the AI assistant, not a
> developer doc — start with the table above.
