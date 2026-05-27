# Architecture

System design for the GAS React Web App. Read this before making structural
changes. For the day-to-day workflow see [DEVELOPMENT.md](DEVELOPMENT.md);
to add a feature see [CONTRIBUTING.md](CONTRIBUTING.md).

## 1. The stack (fixed)

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite 5 (SWC) | Modern UI, fast builds |
| Bundling | `vite-plugin-singlefile` | GAS serves one self-contained HTML file |
| Transport | `gas-client` over `google.script.run` | The only browser→server channel GAS allows |
| Backend | Google Apps Script (V8 runtime), plain JS | Hosts the app; no separate server |
| Database | Google Sheets (`SpreadsheetApp`) | One spreadsheet, one tab per entity |
| Tooling | `clasp` | Push/deploy code to the Apps Script project |

This stack is a deliberate constraint, not a default. The non-goals in §6 explain
what we are **not** building and why.

## 2. The constraint that shapes everything

Google Apps Script is the runtime, and it dictates the architecture:

| GAS reality | Consequence for this project |
|---|---|
| HtmlService serves **one self-contained HTML file** — no external JS/CSS | Frontend builds to a single inlined `dist/index.html` |
| Browser↔server only via **`google.script.run`** — no `fetch`, REST, or sockets | The "API" is GAS global functions, not HTTP endpoints |
| Server is **stateless per call**; ~6 min execution cap; no daemon | No long-running services, no in-memory state across calls |
| Storage is **Sheets / Properties / Cache / Drive** | The "database" is a spreadsheet; no SQL, joins, or transactions |
| Deploy is a **flat file push** (`clasp push`) | Build flattens client + server into one `dist/` directory |

Design within these limits instead of fighting them.

## 3. System diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ Browser  (rendered inside the GAS iframe)                          │
│                                                                    │
│  React components ── useXxx() hook ── server.ts (typed RPC bridge) │
│                                              │                     │
└──────────────────────────────────────────────│────────────────────┘
                                   google.script.run  (ONLY channel)
┌──────────────────────────────────────────────▼────────────────────┐
│ Apps Script V8 runtime  (stateless, one invocation per call)       │
│                                                                    │
│  webapp.js (doGet)                                                 │
│      └─ serves dist/index.html                                     │
│                                                                    │
│  api.js (RPC surface)  →  services/ (business logic)  →  sheets.js │
│   thin: validate+route      rules, orchestration         (DAL)     │
└──────────────────────────────────────────────│────────────────────┘
                                          SpreadsheetApp
┌──────────────────────────────────────────────▼────────────────────┐
│ Google Sheet = database   (one tab per entity, header row = schema)│
└────────────────────────────────────────────────────────────────────┘
```

## 4. The frontend/backend boundary

The contract between the two sides is a **single TypeScript interface**, not a
network protocol:

- **`src/shared/types.ts`** is the source of truth. `ServerFunctions` lists every
  callable function with its argument and return types.
- The **client** imports it so `server.ts` is fully typed.
- The **server** asserts conformance at compile time via `src/server/contract.ts`
  (typechecked, never pushed).
- **`src/client/server.ts`** is the bridge. It is the *only* place that touches
  `google.script.run`. It runs the real `gas-client` inside the deployed iframe,
  and an **in-memory mock** during local `vite` dev — so the entire UI is
  buildable offline. No component ever calls `google.script.run` directly.

Change the contract → both sides' typechecks tell you what drifted. This is what
lets the layers evolve independently.

## 5. Layers and where logic lives

### Frontend (`src/client/`)
```
main.tsx            mount only
app/App.tsx         shell: layout, error boundary — no business logic
features/<name>/    one folder per feature: view + useXxx() data hook + components
lib/server.ts       the RPC bridge (real vs. mock). The hard boundary.
styles/
```
- **Server state** belongs in feature hooks (`useInventory`), which wrap `server.*`
  and own loading/error/optimistic state. Consider TanStack Query as this grows —
  GAS round-trips are slow and uncached.
- **Local UI state** stays in component `useState`.

### Backend (`src/server/`)
```
webapp.js           transport: doGet() serves the HTML. No logic.
api.js              RPC surface: thin — validate args, delegate, return.
services/<name>.js  business logic: rules, orchestration, cross-entity ops.
sheets.js           data-access layer (DAL): the ONLY file touching SpreadsheetApp.
lib/                validate.js, sheetRepo.js (generic tab CRUD), lock helpers.
contract.ts         compile-time conformance check. NOT pushed.
```
Rule of thumb: `api.js` functions are routing shims; real work lives in `services/`;
all spreadsheet access funnels through `sheets.js`/`sheetRepo`.

## 6. Non-goals (intentional)

- ❌ No separate REST/Node backend — `google.script.run` is the channel.
- ❌ No relational/document DB — Sheets is the chosen backend.
- ❌ No SSR, WebSockets, or server-side sessions — the runtime can't host them.
- ❌ No multi-bundle / micro-frontends — the single-file constraint forbids it.

If any of these become hard requirements, the honest answer is "migrate off Apps
Script," which is a different project.

## 7. Architecture decision records (ADRs)

Short, durable rationale for the choices above.

- **ADR-001 — Single-file frontend bundle.** GAS HtmlService can only serve one
  self-contained file, so Vite inlines all JS/CSS via `vite-plugin-singlefile`.
  Trade-off: no code splitting; keep the bundle lean.
- **ADR-002 — RPC via `google.script.run`, wrapped by gas-client.** It is the only
  sanctioned channel. We hide it behind `server.ts` so callers see typed promises.
- **ADR-003 — Mock backend in `server.ts`.** Local dev has no GAS host; a mirror
  mock lets the full UI run offline. Mock parity is part of the definition of done.
- **ADR-004 — Server is plain JS, typechecked out-of-band.** GAS V8 runs modern JS
  with no transpile step, so server files push as-is. Type safety comes from
  `tsconfig.server.json` + `contract.ts`, not from the push pipeline.
- **ADR-005 — Sheets as the database.** Zero infra, lives in the user's Drive.
  Trade-off: no transactions/indexes → wrap writes in `LockService`, batch I/O,
  cache reads. See [DATA_MODEL.md](DATA_MODEL.md).
- **ADR-006 — `shared/types.ts` is the contract.** One interface both sides compile
  against keeps client and server in lockstep without a network schema.

## 8. Cross-cutting concerns

| Concern | Direction |
|---|---|
| Validation | Centralize in `server/lib/validate.js`; never trust client input. |
| Errors | Server throws `Error(message)`; the bridge surfaces it; UI shows per-feature error state + an app-level error boundary. |
| Concurrency | Wrap all Sheets **writes** in `LockService.getScriptLock()` (read-then-write races otherwise). |
| Performance | Batch Sheet reads/writes; cache hot reads with `CacheService`. Never loop cell-by-cell. |
| Auth | Manifest sets `access`/`executeAs` ([appsscript.json](../appsscript.json)). Use `Session.getActiveUser()` for per-user data. |
| Logging | `console.log` → Stackdriver; tail with `npm run logs`. |

## 9. Roadmap (within this stack)

1. **Refactor to target shape** — extract `services/`, generalize `sheets.js` into a
   `sheetRepo(name, headers)`, add `LockService` + `validate.js`.
2. **Frontend foundation** — feature folders + data hooks, error boundary, optional
   TanStack Query.
3. **Second entity** — prove the pattern end-to-end (tab + types + service + view).
4. **Hardening** — auth decision, caching, structured logging, CI typecheck gate.
