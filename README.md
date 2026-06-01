# GAS — Enterprise Inventory Reconciliation & Accountability System

A Google Apps Script **web app** with a **React (Vite)** frontend and **Google
Sheets as the backend**. The UI bundles into a single HTML file that Apps Script
serves from `doGet()`; the browser talks to the server via `google.script.run`
(wrapped as typed promises by `gas-client`).

> **System purpose:** Detect mismatches between cashier count, physical count, and
> POS/system inventory; classify variance; assign investigation; require approval;
> post final stock corrections as immutable ledger entries.
> The system is **reconciliation-first** — inventory tracking is a consequence,
> not the primary feature.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite 5 (SWC) + Tailwind + shadcn/ui |
| Bundling | `vite-plugin-singlefile` (GAS serves one self-contained HTML file) |
| Transport | `gas-client` over `google.script.run` (the only browser→server channel GAS allows) |
| Backend | Google Apps Script (V8 runtime), plain JS |
| Database | Google Sheets — one tab per entity, header row = schema |
| Routing | `react-router-dom` HashRouter (`/#/path`) — required by GAS iframe constraint |
| Tooling | `clasp` — pushes/deploys to Apps Script |
| Contract | `src/shared/types.ts` — single TypeScript source of truth for client↔server shape |

## Quick start

```bash
npm install
npm run login            # authenticate clasp (once per machine)
npm run setup            # create the Sheets-bound Apps Script project
npm run deploy:version   # build, push, cut first web-app deployment
```

Develop locally:

```bash
npm run dev              # Vite dev server + HMR against in-memory mock backend
npm run deploy           # build + push; updates live web app in place
```

The dev server runs against a mock — the header badge shows `local mock` vs `Sheets backend`.

## Core business rules (non-negotiable)

1. **No direct stock editing.** All stock changes are ledger movement entries (`StockMovements` sheet). Current stock = computed from movements.
2. **All inventory changes belong to a session.** A `ReconciliationSession` owns every count, import, variance, approval, and posting for a branch/date/shift.
3. **Posted sessions are read-only.** Reopening requires admin approval and is logged.
4. **Blind physical count.** Counters never see expected or system quantities while counting.
5. **Critical variances require evidence.** Reason code + attachment before approval is possible.
6. **Self-approval restriction.** Users cannot approve their own critical variance.

## Role model

| Role | Key capability |
|---|---|
| `admin` | Full system; configure roles; reopen locked sessions |
| `ops_manager` | Create/cancel sessions; monitor; assign investigations |
| `reviewer` | Validate counts, POS imports, SKU mapping; request recount |
| `approver` | Approve/reject variances; post adjustments |
| `cashier` | Input opening/sold/returns for own session only |
| `counter` | Blind physical count; upload evidence |
| `auditor` | View-only: audit logs, reports, stock card |

## Documentation

| Doc | For |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, GAS constraints, module map, ADR index |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | All Sheets tabs, schema, ledger model, constraints |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local dev loop, mock backend, conventions, troubleshooting |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Add or change a feature — end-to-end recipe |
| [docs/BACKEND_GUIDELINES.md](docs/BACKEND_GUIDELINES.md) | Layer architecture, services, repositories, mappers, lib |
| [docs/FRONTEND_GUIDELINES.md](docs/FRONTEND_GUIDELINES.md) | Component structure, design system, hooks, routing, RBAC |
| [docs/API_CONTRACT.md](docs/API_CONTRACT.md) | Full `ServerFunctions` reference — every RPC call |
| [docs/SECURITY.md](docs/SECURITY.md) | Auth model, RBAC enforcement, session policy |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Deploy run book, migration, sheet IDs, rollback |
| [docs/TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md) | UAT checklist, acceptance criteria, mock parity |
| [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) | GAS constraints, Sheets limits, deliberate non-goals |
| [docs/ADR/](docs/ADR/) | Architecture Decision Records |
| [docs/AGENTS.md](docs/AGENTS.md) | Claude Code agent context — read this first if you are an AI |
| [docs/DEPLOY_URL.md](docs/DEPLOY_URL.md) | Live script/sheet IDs and `/exec` URLs |

## Build phases

| Phase | Scope | Status |
|---|---|---|
| **P1 — Core** | Product master, users/roles, reconciliation session, cashier count, physical count, POS import, 3-way comparison, investigation/approval/posting, reports | In progress |
| **P2 — Operations** | Receiving, transfers, damage/expiry, mobile barcode | Planned |
| **P3 — Enterprise** | Automated POS sync, analytics automation | Future |
