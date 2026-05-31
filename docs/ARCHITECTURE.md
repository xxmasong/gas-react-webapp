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
│  api.js → services/ → repositories/ → mappers/  (+ lib/ helpers)   │
│  thin RPC   rules      Sheets DAL     row↔entity                   │
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
- The **client** imports it so `lib/server.ts` is fully typed.
- The **server** type-checks the contract via `src/server/contract.ts` (never pushed).
  Note: `contract.ts` checks that the shared interface compiles within the server
  project; it does **not** mechanically prove `api.js` implements `ServerFunctions`
  (api.js is plain JS). Keeping them in sync is a manual discipline — see
  [BUSINESS_LOGIC.md §6](BUSINESS_LOGIC.md).
- **`src/client/lib/server.ts`** is the bridge. It is the *only* place that touches
  `google.script.run`. It runs the real `gas-client` inside the deployed iframe,
  and an **in-memory mock** during local `vite` dev — so the entire UI is
  buildable offline. No component ever calls `google.script.run` directly.
  (`src/client/server.ts` is just a re-export shim of this file.)

Change the contract → both sides' typechecks tell you what drifted. This is what
lets the layers evolve independently.

## 5. Layers and where logic lives

### Frontend (`src/client/`)
```
main.tsx            mount only
App.tsx             shell: layout + live/mock badge — no business logic
server.ts           re-export shim → lib/server.ts
features/<name>/    one folder per feature: view + useXxx() data hook + components
lib/server.ts       the RPC bridge (real vs. mock). The hard boundary.
styles.css          hand-written CSS (no Tailwind/shadcn yet)
```
- **Server state** belongs in feature hooks (`useInventory`), which wrap `server.*`
  and own loading/error/optimistic state. Consider TanStack Query as this grows —
  GAS round-trips are slow and uncached.
- **Local UI state** stays in component `useState`.
- An app-level error boundary and any `app/`/`shared/components/` structure are
  **target state**, not present today (see [FRONTEND_GUIDELINES.md](FRONTEND_GUIDELINES.md)).

### Backend (`src/server/`)
```
webapp.js                    transport: doGet() serves the HTML. No logic.
api.js                       RPC surface: thin — validate args, delegate, return.
services/<name>.js           business logic: rules, orchestration, cross-entity ops.
repositories/<name>.js       data-access layer (DAL): the ONLY files touching SpreadsheetApp.
mappers/<name>.js            pure row[]↔entity transforms (no I/O).
lib/                         validate.js, errors.js, lock.js, cache.js, uuid.js, datetime.js.
contract.ts                  compile-time type check (see BUSINESS_LOGIC §6). NOT pushed.
```
Rule of thumb: `api.js` functions are routing shims; real work lives in `services/`;
all spreadsheet access funnels through `repositories/` (each repo uses its `mapper`).

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

1. ~~**Refactor to target shape** — extract `services/`, repositories/mappers, add
   `LockService` + `validate.js`.~~ **Done** — the 5-layer backend is in place.
2. ~~**Frontend foundation** — feature folders + data hooks.~~ **Done**
   (`features/inventory/` + `useInventory`). Error boundary + optional TanStack Query
   remain future work (see [FRONTEND_GUIDELINES.md](FRONTEND_GUIDELINES.md) target section).
3. **Second entity** — prove the pattern end-to-end (tab + types + service + repo + view).
4. **Hardening** — auth decision, structured logging, tests, CI typecheck gate.
5. **Real contract enforcement** — make `contract.ts` actually assert `api.js` conforms
   (today it only type-checks the shared interface; see BUSINESS_LOGIC §6).
