# GAS — Inventory Management System

A Google Apps Script **web app** with a **React (Vite)** frontend and **Google Sheets** as the backend.
The UI bundles into a single inlined HTML file served from `doGet()`; the browser communicates via `google.script.run` wrapped by `gas-client`.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite 5 (SWC) + Tailwind + shadcn/ui |
| Bundling | `vite-plugin-singlefile` — one self-contained HTML file |
| Transport | `gas-client` over `google.script.run` |
| Backend | Google Apps Script (V8), plain JS |
| Database | Google Sheets — one tab per entity |
| Routing | `react-router-dom` HashRouter (`/#/path`) |
| Contract | `src/shared/types.ts` — single source of truth for client↔server shape |

## Quick start

```bash
npm install
npm run login            # authenticate clasp (once per machine)
npm run setup            # create the Sheets-bound Apps Script project
npm run deploy:version   # build, push, cut first versioned deployment
```

Local dev (in-memory mock, no GAS connection):

```bash
npm run dev
```

Header badge shows `local mock` vs `Sheets backend`.

## Roles

| Role | Rank | Capability |
|---|---|---|
| `inventory_staff` | 1 | Update stock quantities |
| `supervisor` | 2 | Manage categories and SKUs |
| `admin` | 3 | Manage users |

## Development reference

Everything is in **[CLAUDE.md](CLAUDE.md)** — architecture, rules, data model, API surface, code patterns, commands, troubleshooting. No separate docs folder.
