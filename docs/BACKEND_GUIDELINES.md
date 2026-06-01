# Backend Guidelines

Rules and conventions for the Google Apps Script + Google Sheets backend.
Read [ARCHITECTURE.md](ARCHITECTURE.md) first for system-level context; this doc
is the implementation standard for everything under `src/server/`.

---

## 1. Folder structure

```
src/server/
  webapp.js                       transport only: doGet() — no logic
  api.js                          RPC surface: thin shim — validate, delegate, return
  config.js                       sheet names, TTLs, roles, store codes
  services/
    authService.js                session management, RBAC
    reconciliationService.js      session lifecycle, 3-way comparison engine
    cashierCountService.js        cashier count input and formula
    physicalCountService.js       blind count, condition split, recount
    posImportService.js           CSV/XLSX upload, SKU mapping, row validation
    varianceService.js            classify, investigate, approve, reject
    postingService.js             approved adjustments → StockMovements; session lock
    inventoryComputationService.js  compute current stock from StockMovements ledger
    inventoryService.js           product master CRUD (InventoryItems, SkuCategories)
    summaryService.js             reports, dashboards, analytics
    auditService.js               immutable audit log writes
  repositories/
    skuCategoryRepository.js
    inventoryItemRepository.js
    stockMovementRepository.js
    locationRepository.js
    reconciliationSessionRepository.js
    cashierCountRepository.js
    physicalCountRepository.js
    posImportRepository.js
    reconciliationResultRepository.js
    varianceInvestigationRepository.js
    varianceApprovalRepository.js
    attachmentRepository.js
    auditLogRepository.js
    userRepository.js
    sessionRepository.js
  mappers/
    skuCategoryMapper.js
    inventoryItemMapper.js
    stockMovementMapper.js
    reconciliationSessionMapper.js
    cashierCountMapper.js
    physicalCountMapper.js
    posImportMapper.js
    reconciliationResultMapper.js
    varianceMapper.js
    auditLogMapper.js
    userMapper.js
  lib/
    validate.js       argument validators
    errors.js         AppError class + error codes
    lock.js           LockService wrapper
    cache.js          CacheService wrapper
    uuid.js           ID generation wrapper
    datetime.js       date/timestamp helpers
  contract.ts         compile-time conformance check — NOT pushed
```

Every file is pushed to GAS **except** `contract.ts`. `lib/` functions have zero GAS
dependencies — they are testable in Node without a GAS runtime.

---

## 2. Layer responsibilities

Each layer has one job. Code in the wrong layer is the most common source of
hard-to-maintain backend code.

```
┌─────────────────────────────────────────────┐
│  api.js          RPC surface                │  ← entry point from client
│                                             │    auth check → validate → delegate
├─────────────────────────────────────────────┤
│  services/       Business logic             │  ← rules, workflows, decisions
│                                             │    "what should happen and why"
├─────────────────────────────────────────────┤
│  repositories/   Data access                │  ← "how to read/write the sheet"
│                                             │    no business rules here
├─────────────────────────────────────────────┤
│  mappers/        Transformation             │  ← row[] ↔ entity — pure functions
├─────────────────────────────────────────────┤
│  lib/            Utilities                  │  ← validate, errors, lock, cache,
│                                             │    uuid, datetime — stateless helpers
└─────────────────────────────────────────────┘
         ↓ only direction allowed ↓
         api → service → repository → mapper
                                   → lib (any layer may use lib)
```

Repositories never call services. Mappers never call repositories. `lib/` has no
dependencies on any other layer.

---

## 3. RPC surface — api.js

`api.js` is the **only** file whose top-level functions are exposed to the client
via `google.script.run`. It is a thin routing shim — no business logic lives here.

### Responsibilities

- Validate the session token and role (first, always).
- Validate input arguments via `validate.*`.
- Delegate to the appropriate service.
- Return a JSON-serializable result.
- Re-throw errors as `AppError`.

### Template

```js
function createReconciliationSession(token, params) {
  AuthService.requireRole(token, ROLE.OPS_MANAGER);
  validate.required(params.branch, 'branch');
  validate.string(params.date, 'date');
  validate.string(params.shift, 'shift');
  return ReconciliationService.createSession(params);
}
```

Never put a `try/catch` here unless you are rethrowing. Let errors propagate to
the GAS runtime, which surfaces them to the client as rejected promises.

---

## 4. Service layer — business logic

Services contain all rules, workflows, and cross-entity operations. Each service
corresponds to a domain area.

### Core services and their roles

**`reconciliationService.js`**
- `createSession(params)` — validates uniqueness (one active session per branch/date/shift, BR-003), creates `ReconciliationSessions` row in `draft` status.
- `openSession(sessionId)` — `draft → open`; validates required fields.
- `submitSession(sessionId)` — `open → submitted`; runs completeness check (all three count sources present).
- `runComparison(sessionId)` — runs the 3-way engine; writes `ReconciliationResults`; transitions to `under_review`.
- `lockSession(sessionId)` — `posted → locked`; sets `locked_at`.
- `reopenSession(sessionId, reason, adminId)` — admin only; logs reopen; sets status back to `under_review`.

**`cashierCountService.js`**
- `saveLine(sessionId, skuId, data)` — validates session is `open`; computes `expected_ending_qty = opening - sold + return`.
- `submitCount(sessionId, cashierId)` — locks cashier count; `submitted_at` set.
- Enforces: return condition required if `return_qty > 0` (BR-011).

**`physicalCountService.js`**
- `getCountForm(sessionId, userId)` — returns SKU list **without** expected/system quantities for `counter` role (blind count, BR-004).
- `saveLine(sessionId, skuId, locationId, data)` — validates session is `open`.
- `requestRecount(varianceId, assignedCounterId, reason)` — creates recount task; flags result row.

**`posImportService.js`**
- `importFile(sessionId, rows)` — creates `PosImportBatch`; validates each row; resolves `sku_id` from mapping table.
- `mapSku(posCode, skuId)` — updates `PosImportLines.sku_id`; clears validation error.
- Unmapped rows block comparison (BR-010).

**`varianceService.js`**
- `classify(cashierQty, physicalQty, systemQty, tolerance)` — pure classification function implementing all 9 cases from the reconciliation matrix.
- `assignInvestigation(resultId, assigneeId, dueDate, assignedBy)` — creates `VarianceInvestigations` row.
- `submitInvestigation(investigationId, data)` — saves reason code, remarks; validates evidence attached for critical (BR-005).
- `approve(investigationId, approverId, decision, approvedQty, remarks)` — enforces self-approval restriction (BR-006); creates `VarianceApprovals` row; calls `auditService.log`.
- `reject(investigationId, approverId, reason)` — sets investigation back to `open`.

**`postingService.js`**
- `postApprovedAdjustments(sessionId, approverId)` — iterates approved variances; creates `StockMovements` entries for each; transitions session to `posted`; calls `auditService.log`.
- This is the **only** place that creates `StockMovements` for reconciliation adjustments.
- Uses `LockService.getScriptLock()` — entire posting is atomic or rolls back (NFR-007).

**`inventoryComputationService.js`**
- `getCurrentStock(skuId, locationId?)` — sums `StockMovements` for the SKU; returns computed balance.
- `getCurrentStockAll(sessionId?)` — batch computation for all SKUs; result is cached per `CACHE_TTL.inventoryItems`.
- This service **reads only** — never writes.

**`auditService.js`**
- `log(userId, action, entityType, entityId, oldValue?, newValue?)` — appends to `AuditLogs`; immutable; never throws (log failure must not block the primary action, but should `console.error`).

### Business rule enforcement in services (recap)

| Rule | Where enforced |
|---|---|
| BR-001 No direct stock edit | `api.js` — no function exposes a direct qty write |
| BR-002 Ledger-based stock | `inventoryComputationService` only reads movements |
| BR-003 One active session | `reconciliationService.createSession` |
| BR-004 Blind count | `physicalCountService.getCountForm` + role check in `api.js` |
| BR-005 Critical variance evidence | `varianceService.approve` |
| BR-006 Self-approval | `varianceService.approve` |
| BR-007 Posted session read-only | All write services check `session.status` before proceeding |
| BR-008 Soft delete | All repositories — `deleted_at` + `deleted_by` only |
| BR-009 Cost visibility | `summaryService` + `inventoryService` strip cost for non-manager roles |
| BR-010 Unmapped POS blocks reconcile | `reconciliationService.runComparison` |
| BR-011 Return condition required | `cashierCountService.saveLine` |

---

## 5. Repository layer — data access

One repository per Sheet tab. Repositories know how to read and write rows; they
contain no business rules.

### Repository contract

Every repository must implement:

```js
// Read
findAll(filters?)         → entity[]
findById(id)              → entity | null
findByField(field, value) → entity[]

// Write (always acquires script lock)
insert(entity)            → entity     // assigns id + created_at
update(id, fields)        → entity     // updates updatedAt
softDelete(id, userId)    → { id }     // sets deleted_at + deleted_by
```

Immutable repositories (`stockMovementRepository`, `auditLogRepository`) expose
only `insert` and `findAll` — no update, no delete.

### Required patterns

```js
// Always batch — never cell-by-cell
var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();

// Always lock writes
var lock = LockService.getScriptLock();
lock.waitLock(30000);
try {
  sheet.appendRow(rowValues);
} finally {
  lock.releaseLock();
}
```

---

## 6. Mapper layer — transformation

Mappers are **pure functions** that convert between a Sheets row array and an entity
object. No side effects, no I/O, no service calls.

```js
// inventoryItemMapper.js

function rowToInventoryItem(row) {
  return {
    id:          row[0],
    categoryId:  row[1],
    store:       row[2],
    sku:         row[3],
    // …
  };
}

function inventoryItemToRow(item) {
  return [
    item.id,
    item.categoryId,
    item.store,
    item.sku,
    // …
  ];
}
```

Column order must match `HEADERS` exactly.

---

## 7. Utility functions — lib/

| File | Purpose |
|---|---|
| `validate.js` | `validate.string(v, name)`, `validate.nonNegativeNumber(v, name)`, `validate.uuid(v, name)`, `validate.required(v, name)`, `validate.oneOf(v, options, name)` |
| `errors.js` | `AppError(message, code)` — subclass of Error with a machine-readable code |
| `lock.js` | `withScriptLock(fn, timeoutMs?)` — wraps `LockService.getScriptLock()` + try/finally |
| `cache.js` | `withCache(key, ttl, fn)` — reads `CacheService`, falls back to `fn()`, writes result |
| `uuid.js` | `newUuid()` — wraps `Utilities.getUuid()` |
| `datetime.js` | `now()` → ISO string, `today()` → YYYY-MM-DD, `isExpired(isoString)` → boolean |

---

## 8. Validation rules

Input validation happens in `api.js` using `validate.*` before any service call.

- **All string fields:** `validate.string(v, name)` — rejects null, undefined, non-string, empty after trim.
- **All numeric fields:** `validate.nonNegativeNumber(v, name)` or `validate.positiveNumber(v, name)`.
- **All UUIDs:** `validate.uuid(v, name)`.
- **All enum fields:** `validate.oneOf(v, VALID_VALUES, name)`.
- **Qty fields:** must be `>= 0`; negative qty is always an error at the API boundary.
- **Token:** every non-auth function calls `AuthService.requireRole(token, minimumRole)` first.

---

## 9. Error handling

All services throw `AppError(message, code)`. `api.js` lets it propagate — GAS surfaces
it to the client as a rejected promise with the message string.

```js
// lib/errors.js
function AppError(message, code) {
  var e = new Error(message);
  e.code = code || 'ERR_GENERIC';
  return e;
}

// Error codes (prefix by domain)
// AUTH_INVALID_TOKEN, AUTH_INSUFFICIENT_ROLE, AUTH_SELF_APPROVAL
// REC_DUPLICATE_SESSION, REC_SESSION_LOCKED, REC_INCOMPLETE_SOURCES
// VAR_MISSING_EVIDENCE, VAR_UNMAPPED_SKU
// POST_UNAPPROVED_ITEM, POST_LOCK_FAILED
```

The client normalizes error messages in `server.ts` — feature hooks receive a string
`error` state they can display inline.

---

## 10. Concurrency and locking

Every Sheets **write** must acquire the script lock:

```js
// lib/lock.js
function withScriptLock(fn, timeoutMs) {
  var lock = LockService.getScriptLock();
  lock.waitLock(timeoutMs || 30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}
```

The posting service acquires the lock for the entire posting batch — no partial writes
are possible (NFR-007 Atomic Posting).

Reads do not require the lock unless they are immediately followed by a write
(read-then-write race).

---

## 11. Caching

Hot reads are cached via `CacheService` to mitigate GAS round-trip latency:

```js
// lib/cache.js
function withCache(key, ttl, fn) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var result = fn();
  cache.put(key, JSON.stringify(result), ttl);
  return result;
}
```

Cache TTLs are defined in `config.js`. Every write service calls `invalidateCache(key)`
after mutating the relevant sheet.

**Do not cache:** session-specific data (cashier counts, physical counts, variance
results) — these vary per user/session and cannot share a script-wide cache key.

---

## 12. The 3-way comparison engine

`varianceService.classify(cashierQty, physicalQty, systemQty, tolerance)` implements
the full reconciliation matrix:

| Case | Condition | Classification |
|---|---|---|
| CASE-001 | All three within tolerance | `matched` |
| CASE-002 | Physical < system (cashier ≈ system) | `physical_shortage` |
| CASE-003 | Physical > system (cashier ≈ system) | `physical_overage` |
| CASE-004 | Cashier differs; physical ≈ system | `cashier_mismatch` |
| CASE-005 | System differs; cashier ≈ physical | `system_mismatch` |
| CASE-006 | All three differ | `critical` |
| CASE-007 | System qty missing (no POS import / unmapped) | `incomplete` |
| CASE-008 | Physical qty missing | `incomplete` |
| CASE-009 | System qty is negative | `system_exception` |

Tolerance is configurable per-session or globally in `config.js`. Default: 0 (exact match required).

---

## 13. Role model

Roles are defined in `config.js` and enforced server-side via `AuthService.requireRole`:

| Role constant | Value | Rank |
|---|---|---|
| `ROLE.ADMIN` | `admin` | 7 |
| `ROLE.OPS_MANAGER` | `ops_manager` | 6 |
| `ROLE.REVIEWER` | `reviewer` | 5 |
| `ROLE.APPROVER` | `approver` | 4 |
| `ROLE.CASHIER` | `cashier` | 3 |
| `ROLE.COUNTER` | `counter` | 2 |
| `ROLE.AUDITOR` | `auditor` | 1 |

`AuthService.requireRole(token, minRole)` checks `userRoleRank >= minRoleRank`.
`AuthService.requireUser(token)` accepts any authenticated user (rank ≥ 1).

Key per-action role gates (non-exhaustive):

| Action | Minimum role |
|---|---|
| Create/cancel session | `ops_manager` |
| Submit cashier count | `cashier` (own session only) |
| Submit physical count | `counter` (assigned session only) |
| Upload POS import | `reviewer` |
| Run comparison | `reviewer` |
| Assign investigation | `reviewer` |
| Approve/reject variance | `approver` |
| Post adjustments | `approver` |
| View cost / variance value | `ops_manager` |
| Create/edit product (SKU) | `ops_manager` |
| View audit logs | `auditor` (any) or `admin` |
| Reopen locked session | `admin` |

---

## 14. GAS-specific rules

- **Top-level named functions only** in `api.js` — not arrow functions, not nested, not exported from a module. GAS exposes globals.
- **No `import`/`export` in pushed files** — GAS V8 does not support ES modules. Use global variables and the IIFE pattern for encapsulation (`var Config = (function() { ... })()`).
- **Execution cap is ~6 minutes.** Long-running operations (large POS file imports) must be chunked or use time-based triggers.
- **`CacheService` keys are strings; values are strings.** Always `JSON.stringify`/`JSON.parse`.
- **`LockService.waitLock(ms)`** throws if the lock cannot be acquired within the timeout — catch it and return a meaningful error to the client.
- **`Utilities.getUuid()`** is the only UUID source — do not use client-generated IDs.
- **`console.log`** goes to Stackdriver (`npm run logs` to tail).
- **No `require` / CommonJS** — all dependencies are global or inlined.
