# AGENTS — Claude Code context

This file is the first thing a Claude Code agent should read. It gives you the context
needed to work on this codebase without deriving it from scratch.

---

## What this system is

**Enterprise Inventory Reconciliation & Accountability System** for Easy Brand Cebu / Easy Cebu.

This is **not** a generic inventory tracker. It is a **reconciliation-first** platform:
the primary purpose is detecting and resolving mismatches between three independent
count sources (cashier, physical, POS/system) before any stock correction is posted.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite 5 + Tailwind + shadcn/ui |
| Backend | Google Apps Script (V8), plain JS |
| Transport | `google.script.run` via `gas-client` (the ONLY channel) |
| Database | Google Sheets — one tab per entity |
| Routing | `react-router-dom` HashRouter (`/#/path`) |
| Bundling | `vite-plugin-singlefile` — one self-contained HTML file |

The GAS constraint is not negotiable: there is no REST API, no `fetch`, no WebSockets,
no SQL database. Everything runs through `google.script.run`.

---

## The single most important rule

**No direct stock quantity editing.**

All stock changes are `StockMovements` ledger entries. Current stock is **computed**
from that ledger by `inventoryComputationService`. Any function that writes a quantity
directly to `InventoryItems` violates BR-001 and must not exist.

The old `bulkUpdateStock` and `saveAndVerifyStock` functions are **deprecated** and
must not be used for new features.

---

## Key files

| File | Purpose |
|---|---|
| `src/shared/types.ts` | The contract — all entity types + `ServerFunctions`. Edit this first. |
| `src/client/lib/server.ts` | RPC bridge — real GAS call vs in-memory mock. The only file that touches `google.script.run`. |
| `src/server/api.js` | RPC surface — thin shims only (validate → delegate → return). |
| `src/server/config.js` | Sheet names, TTLs, roles, store codes. |
| `src/server/services/reconciliationService.js` | Session lifecycle + 3-way comparison engine. |
| `src/server/services/postingService.js` | ONLY place that creates StockMovements for adjustments. |
| `src/server/services/auditService.js` | ONLY place that writes AuditLogs. |
| `src/client/routes/paths.ts` | All route path constants. |
| `src/client/routes/guards.tsx` | Auth + role guards. |

---

## TypeScript conventions

- **`type` over `interface`** everywhere — project-wide convention.
- No `any` — use `unknown` and narrow.
- `strict: true` — no exceptions.
- Shared entity types live in `src/shared/types.ts` only — never duplicate.

---

## Backend conventions

- **Layer order:** `api.js → service → repository → mapper`. Never skip layers.
- **Lock all writes:** `LockService.getScriptLock()` before every Sheets mutation.
- **Soft delete only:** `deleted_at` + `deleted_by` — never delete a row.
- **Audit all sensitive actions:** `auditService.log()` on every approve/post/reopen.
- **No ES modules in server files** — GAS V8 does not support `import`/`export`. Use IIFEs.
- **No top-level arrow functions in api.js** — GAS only exposes named function declarations.

---

## Frontend conventions

- **`server.*` calls in hooks only** — never in components.
- **`server.ts` is the only file** that touches `google.script.run`.
- **Route paths are constants** in `routes/paths.ts` — never hardcode strings.
- **Role gates at route level** via `<RequireRole>` — never inside feature components.
- **Mock parity required** — every server function change needs a matching mock update.

---

## Role model

`admin > ops_manager > reviewer > approver > cashier > counter > auditor`

Role rank is enforced server-side in `AuthService.requireRole(token, minRole)`.
UI role gates (`<RequireRole>`) are convenience only — not security.

---

## Workflow state machine (ReconciliationSession.status)

`draft → open → submitted → under_review → investigation → recount → under_review → approved → posted → locked`

Reopen (`locked → reopened → under_review`) requires admin; is logged in AuditLogs.

---

## 3-way comparison classification

| Classification | Condition |
|---|---|
| `matched` | All three within tolerance |
| `physical_shortage` | Physical < system (cashier ≈ system) |
| `physical_overage` | Physical > system (cashier ≈ system) |
| `cashier_mismatch` | Cashier differs; physical ≈ system |
| `system_mismatch` | System differs; cashier ≈ physical |
| `critical` | All three differ |
| `incomplete` | A count source is missing or unmapped |
| `system_exception` | System qty is negative |

---

## What is NOT built yet (P1 still in progress)

The following features are specified in the SRS but not yet implemented:

- `StockMovements` sheet + `inventoryComputationService` (ledger model)
- `ReconciliationSessions` entity + full status machine
- `CashierCounts`, `PhysicalCounts` entities
- `PosImportBatches` + `PosImportLines` + SKU mapping
- `ReconciliationResults` + 3-way comparison engine
- `VarianceInvestigations` + `VarianceApprovals`
- `postingService` (posting approved adjustments to ledger)
- Expanded role model (currently only `admin`, `supervisor`, `inventory_staff`)
- Reconciliation UI screens (sessions, cashier entry, physical count, POS import, comparison, investigation, approval queue, posting)

The existing codebase has: product master (InventoryItems + SkuCategories), auth (users + sessions), basic dashboard + analytics, direct stock editing (deprecated).

---

## Memory

Project memories are in `C:\Users\Notissia\.claude\projects\d--GAS\memory\`.
Check `MEMORY.md` there for user preferences and prior decisions.
