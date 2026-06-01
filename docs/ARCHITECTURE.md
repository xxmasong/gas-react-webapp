# Architecture

System design for the Enterprise Inventory Reconciliation & Accountability System.
Read this before making structural changes. For day-to-day workflow see
[DEVELOPMENT.md](DEVELOPMENT.md); to add a feature see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 1. The stack (fixed)

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite 5 (SWC) | Modern UI, fast builds |
| Bundling | `vite-plugin-singlefile` | GAS serves one self-contained HTML file |
| Routing | `react-router-dom` HashRouter | GAS iframe has no real URL control; `/#/path` is the only viable strategy |
| UI system | Tailwind + shadcn/ui | Owned component code, ARIA-compliant Radix primitives, no runtime dep |
| Transport | `gas-client` over `google.script.run` | The only browser→server channel GAS allows |
| Backend | Google Apps Script (V8 runtime), plain JS | Hosts the app; no separate server |
| Database | Google Sheets (`SpreadsheetApp`) | One spreadsheet, one tab per entity |
| Tooling | `clasp` | Push/deploy code to the Apps Script project |
| Contract | `src/shared/types.ts` | Single TypeScript interface both sides compile against |

This stack is a deliberate constraint. See §6 for non-goals and [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md)
for the full list of GAS-imposed limits.

---

## 2. The constraint that shapes everything

Google Apps Script dictates the architecture:

| GAS reality | Consequence |
|---|---|
| HtmlService serves **one self-contained HTML file** | Frontend builds to a single inlined `dist/index.html` via `vite-plugin-singlefile` |
| Browser↔server only via **`google.script.run`** — no `fetch`, REST, or sockets | The "API" is GAS global functions, not HTTP endpoints |
| Server is **stateless per call**; ~6 min execution cap; no daemon | No long-running services, no in-memory state across calls |
| Storage is **Sheets / Properties / Cache / Drive** | No SQL, joins, or transactions |
| Deploy is a **flat file push** (`clasp push`) | Build flattens client + server into `dist/` |
| No real URL routing | All routing via HashRouter (`/#/path`) |

Design within these limits, not against them.

---

## 3. System diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ Browser  (rendered inside the GAS iframe)                        │
│                                                                  │
│  React (PublicApp / PrivateApp / MobileApp)                      │
│    └─ feature hooks ── server.ts (typed RPC bridge)              │
│                               │                                  │
└───────────────────────────────│──────────────────────────────────┘
                      google.script.run  (ONLY channel)
┌───────────────────────────────▼──────────────────────────────────┐
│ Apps Script V8 runtime  (stateless, one invocation per call)     │
│                                                                  │
│  webapp.js (doGet) → serves dist/index.html                      │
│                                                                  │
│  api.js (RPC surface)                                            │
│    → authService.js        (session, RBAC)                       │
│    → reconciliationService.js  (session + 3-way engine)          │
│    → cashierCountService.js                                      │
│    → physicalCountService.js                                     │
│    → posImportService.js   (upload, SKU mapping, validation)     │
│    → varianceService.js    (classify, investigate, approve)      │
│    → postingService.js     (ledger write + session lock)         │
│    → inventoryService.js   (product master, legacy)              │
│    → summaryService.js     (reports, dashboards)                 │
│    → auditService.js       (immutable audit log writes)          │
│                                                                  │
│  repositories/ → mappers/ → lib/                                 │
└───────────────────────────────│──────────────────────────────────┘
                           SpreadsheetApp
┌───────────────────────────────▼──────────────────────────────────┐
│ Google Sheet = database  (one tab per entity)                    │
│                                                                  │
│  Core P1: SkuCategories · InventoryItems · StockMovements        │
│           ReconciliationSessions · CashierCounts · PhysicalCounts│
│           PosImportBatches · PosImportLines · SkuMapping         │
│           ReconciliationResults · VarianceInvestigations         │
│           VarianceApprovals · Attachments · AuditLogs            │
│           Users · Sessions                                       │
│                                                                  │
│  P2: GoodsReceipts · Transfers · DamageReports                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. The frontend/backend boundary

The contract between the two sides is a **single TypeScript interface**:

- **`src/shared/types.ts`** is the source of truth. `ServerFunctions` lists every
  callable function with its argument and return types.
- The **client** imports it so `server.ts` is fully typed.
- The **server** asserts conformance at compile time via `src/server/contract.ts`
  (typechecked, never pushed).
- **`src/client/lib/server.ts`** is the bridge — the only file that touches
  `google.script.run`. It runs the real `gas-client` inside the deployed iframe,
  and an **in-memory mock** during local `vite` dev.

Change the contract → both sides' typechecks tell you what drifted.

---

## 5. Application split (routing)

Three distinct sub-apps share the same bundle but are gated by role and device:

| App | Route prefix | Entry guard | Purpose |
|---|---|---|---|
| `PublicApp` | `/login` | Unauthenticated only | Login screen |
| `PrivateApp` | `/*` | Auth required | Desktop reconciliation workflow |
| `MobileApp` | `/m/*` | Auth required + mobile | Cashier & counter data entry |

Route guards live in `src/client/routes/guards.tsx`. The router is defined in
`src/client/routes/index.ts`. Never put routing logic inside feature components.

---

## 6. Layers and where logic lives

### Frontend (`src/client/`)

```
main.tsx                    mount only
App.tsx                     shell: providers, router, error boundary — no logic
apps/
  PublicApp.tsx             unauthenticated routes
  PrivateApp.tsx            desktop authenticated routes
  MobileApp.tsx             mobile authenticated routes
features/<name>/            one folder per domain feature
  components/               feature-specific UI only
  hooks/                    useXxx() — server state, loading, error, actions
  index.ts                  public surface only (barrel)
components/
  atoms/ molecules/ organisms/ templates/   shared design system
lib/server.ts               RPC bridge — the hard boundary
routes/                     path constants + guards
providers/                  Auth, Theme, Layout, Toast
```

### Backend (`src/server/`)

```
webapp.js           transport: doGet() — no logic
api.js              RPC surface: validate → delegate → return
services/           business logic — rules, workflows, orchestration
repositories/       data access — one file per Sheet tab
mappers/            row[] ↔ entity — pure functions only
lib/                validate, errors, lock, cache, uuid, datetime
contract.ts         compile-time conformance check — NOT pushed
```

Dependency rule: `api → service → repository → mapper`. Only `lib` is reachable
from any layer. Repositories never call services; mappers never call repositories.

---

## 7. Core business rules (enforced in services)

These are **system invariants** — never bypass in any layer:

| Rule | ID | Enforcement point |
|---|---|---|
| No direct stock editing | BR-001 | `api.js` blocks any direct qty write; only `postingService` creates `StockMovements` |
| Stock computed from ledger | BR-002 | `inventoryComputationService` sums `StockMovements`; no field stores a mutable qty |
| One active session per branch/date/shift | BR-003 | `reconciliationService.createSession` checks for duplicates |
| Blind count — hide expected qty | BR-004 | `physicalCountService.getCountForm` omits expected/system fields; `api.js` enforces by role |
| Critical variance requires evidence | BR-005 | `varianceService.approve` blocks if reason_code or attachment is missing |
| Self-approval restriction | BR-006 | `varianceService.approve` checks `approverId !== createdById` |
| Posted session is read-only | BR-007 | Every write service checks session status; `Locked` and `Posted` block all mutations |
| Soft delete only | BR-008 | All repositories use `deleted_at` / `deleted_by`; no `DELETE` row calls |
| Cost visibility by role | BR-009 | `summaryService` and `inventoryService` strip cost fields for non-manager roles |
| Unmapped POS rows block reconciliation | BR-010 | `reconciliationService.runComparison` returns `Incomplete` if any SKU is unmapped |

---

## 8. Non-goals (intentional)

- No separate REST/Node backend — `google.script.run` is the channel.
- No relational/document DB — Sheets is the chosen backend.
- No SSR, WebSockets, or server-side sessions — the runtime can't host them.
- No multi-bundle / micro-frontends — the single-file constraint forbids it.
- No general ledger, BIR filing, payroll, AR/AP — out of scope per SRS.
- No manufacturing BOM or production planning — out of scope per SRS.

See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) for details.

---

## 9. Architecture Decision Records

| ADR | Decision |
|---|---|
| [ADR-001](ADR/ADR-001-single-file-bundle.md) | Single-file frontend bundle (GAS constraint) |
| [ADR-002](ADR/ADR-002-rpc-via-google-script-run.md) | RPC via `google.script.run` wrapped by gas-client |
| [ADR-003](ADR/ADR-003-mock-backend.md) | In-memory mock backend for local dev |
| [ADR-004](ADR/ADR-004-server-plain-js.md) | Server in plain JS, typechecked out-of-band |
| [ADR-005](ADR/ADR-005-sheets-as-database.md) | Google Sheets as the database |
| [ADR-006](ADR/ADR-006-shared-types-contract.md) | `shared/types.ts` as the client↔server contract |
| [ADR-007](ADR/ADR-007-hash-router.md) | HashRouter for client-side routing |

---

## 10. Cross-cutting concerns

| Concern | Direction |
|---|---|
| Validation | Centralize in `server/lib/validate.js`; never trust client input |
| Errors | Server throws `AppError`; bridge surfaces it; UI shows per-feature error state + app-level boundary |
| Concurrency | Wrap all Sheets **writes** in `LockService.getScriptLock()` |
| Performance | Batch Sheet reads/writes; cache hot reads with `CacheService`; never loop cell-by-cell |
| Auth | All data functions validate session token server-side via `AuthService.requireRole()` |
| Audit | Every approve/post/reopen action calls `auditService.log()` — never skip |
| Logging | `console.log` → Stackdriver; tail with `npm run logs` |

---

## 11. Troubleshooting quick reference

### Build / bundle

**`dist/index.html not found` during deploy.** Run `npm run build` first, or just `npm run deploy` (which orders them correctly).

**App loads but assets 404 / blank page in GAS.** GAS can only serve one self-contained file. Confirm `dist/index.html` has no external `<script src>` / `<link href>`. If not, check `vite-plugin-singlefile` is active in `vite.config.ts`.

### RPC (`google.script.run`)

**`google is not defined` in dev.** Expected — no GAS host during `npm run dev`. The mock is active; header badge reads `local mock`.

**A new server function isn't callable.** It must be a top-level named function in a pushed `.js` file. Re-deploy after adding. Add the client wrapper + mock branch in `server.ts` and the signature in `ServerFunctions`.

**RPC returns `undefined` or throws serialization errors.** Arguments/returns must be JSON-serializable. Use ISO strings and plain objects, not Dates, functions, or class instances.

### Sheets / data

**`Item not found` on update/delete.** `findRowById_` does a linear scan. The id must match exactly. If deleted concurrently, the lookup fails — see locking.

**Lost or overwritten writes.** Read-then-write race. Wrap mutations in `LockService.getScriptLock()`.

**Slow list/reads.** You are doing per-cell or repeated `getRange` calls. Batch with a single `getValues()`. Cache hot reads with `CacheService`.

### Auth / access

**`/exec` redirects to Google sign-in.** Expected for anonymous visitors. Sign in; the first run prompts to authorize the Sheets scope.

**Authorization prompt loops.** The required scope changed. Re-open the editor (`npm run open`), run any function once to re-trigger consent, then re-deploy.

### clasp / deploy

**`.clasp.json not found`.** Run `npm run login` then `npm run setup`.

**Push succeeds but the live app is unchanged.** The deployment may point at a fixed version, not @HEAD. Check Deploy ▸ Manage deployments; the primary should serve @HEAD.

**Diagnosing server errors.** `npm run logs` tails Stackdriver. Add `console.log` in `api.js` to trace arguments.
