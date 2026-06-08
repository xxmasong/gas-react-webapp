# BOSSS — Business Operations System & Store Support System

Status: **proposal / blueprint** · modular business platform on Apps Script + Google Sheets,
designed to migrate to PostgreSQL later without rewriting business logic.

**BOSSS** = **B**usiness **O**perations **S**ystem & **S**tore **S**upport **S**ystem.
*Not an ERP clone* — it covers both halves most ERPs miss together:

- **Run the business** — Inventory · Sales · Purchasing · HR · Finance · Warehouse · Reporting
- **Improve the business** — 5S · Meetings · Concerns · Tasks · Projects · SOPs · Training ·
  Store Audits · Continuous Improvement  (the **Operations** module — see §0.4)

> Mission: a modular platform that helps companies **operate, manage, govern, and continuously
> improve** their stores, warehouses, distribution centers, and business units.

> **Read §0 first.** It states which parts of the classic enterprise stack map cleanly onto
> GAS and which must be *reshaped* because of platform reality. **§0.x captures the refinements**
> that distinguish BOSSS from the generic blueprint: the Kernel, the two-tier event model, the
> Operations module. The rest of the document is the design with those reshapes applied.

---

## 0.x BOSSS refinements (what makes this BOSSS, not a generic ERP)

These four decisions supersede the "three separate libraries" framing in §1 where they conflict.

### 0.1 One **BOSSS Kernel**, many namespaces (not 3 libraries)
Collapse `Core + Security + Workflow` into a single published library — the **Kernel** —
exposing internal namespaces:
```
Kernel
 ├─ Auth · Session · Token
 ├─ Permissions   (RBAC + ABAC: role · branch · department)
 ├─ Workflow      (state machine + approval matrix)
 ├─ Audit · Logging
 ├─ Cache · Lock · Id · Config
 ├─ Events        (the eventual-side bus — see 0.2)
 ├─ Notifications · Email · File · Pdf
 └─ Repo · Mapper · Validate · Errors · Integration
```
**Why one, specifically on GAS:** cross-library calls carry overhead, and *every* library is a
separate version-pin each module must bump. Three libraries = three pins per change across every
module. **One Kernel = one pin**, lower call overhead, still modular *internally* via namespaces.
All modules (`Inventory · Sales · Purchasing · HR · Finance · Operations · Reporting`) depend on
**Kernel** alone.

### 0.2 Two-tier inter-module coupling — ledger for consistency, Events for eventual
Modules must not call each other directly. But a naive "Events sheet that modules listen to"
is **unsafe on GAS** (no real listeners → trigger polling, ≥1-min latency; Sales-row and
Event-row writes aren't atomic → lost events → silently wrong balances; backlog drains can hit
the 6-min cap; ordering/replay corrupts derived totals). So coupling splits in two:

| Need | Mechanism | Why it's correct |
|---|---|---|
| **Immediate consistency** — e.g. Sales → stock decrement | **Synchronous, same execution, via the append-only ledger.** The Sales write *appends a `stock_movement` (-qty)* inside the **same locked transaction**. | Inventory balance is **derived** from movements, so it's correct *instantly and atomically* — no event, no delay, no lost-event risk. The ledger (§09) already does this. |
| **Eventual side-effects** — notify manager, rebuild dashboard, send email, training reminder, cross-module nudge | **`Kernel.Events`** — append to an `events` tab; a time-driven trigger drains it. | Tolerates ~1-min delay; at-least-once + idempotent handlers; loss is recoverable. |

**Rule:** if losing or delaying the reaction would make a number wrong, it is **ledger**, not
event. Events are for things that may lag a minute and be retried. Event types still catalogued
(`SalesPosted · StockReceived · POApproved · EmployeeHired · LeaveApproved · ConcernReported · …`)
but they trigger *eventual* work only.

```
events tab:  id | type | payloadJson | createdAt | createdBy | status(pending|done|failed) | attempts | requestId
drain trigger:  read pending → handler(type) → mark done (idempotent on requestId) → cap-aware batch size
```

### 0.3 Append-only ledger is the consistency backbone (confirmed, elevated)
Balances/totals are **never edited in place** — they are derived from immutable movement rows
(`stock_movements`, `cash_logs`, …). This gives full audit, impossible-to-hide transactions,
easy rollback, accounting-journal semantics — *and* it's what makes 0.2's synchronous path safe.
This is now a **platform invariant**, not a per-module choice.

### 0.4 Operations module — first-class peer (the BOSSS differentiator)
A module equal to Inventory/Sales, covering **improve-the-business**: `5S · Meetings · Concerns ·
Projects · Action Plans · SOPs · Tasks · Store Audits · Training · Corrective Actions`. It's the
*cheapest* module to build (forms + Workflow + Audit, all Kernel-provided) and the clearest
differentiator from ERPNext-style systems. New data store: **`BOSSS_OPS_DB`** (concerns ·
audits · tasks · sops · trainings · action_plans · meetings). Concerns/audits emit
`ConcernReported`/`AuditCompleted` events → eventual notifications/corrective-action tasks.

---

## 0. GAS reality check — what changes and why

Your 12-layer model is logically correct. But Apps Script is **stateless, single-runtime,
in-process**, and Sheets is **not a transactional database**. That forces five adaptations.
Ignoring these is how an ERP-on-GAS dies in production.

| Your layer | Classic ERP runtime | On GAS — the honest reality | Adaptation in this design |
|---|---|---|---|
| API Gateway (`/api/v1/...`) | Separate service, routes HTTP | **No real routing tier.** One `doGet`/`google.script.run` per module project. "Routes" are just named functions. | Gateway = a thin **in-process dispatcher** + response/version envelope. Not a network hop. |
| Edge Security (rate limit, CSRF, reCAPTCHA) | CDN/WAF in front | **No WAF, no middleware chain.** Token already in `localStorage`; iframe origin is Google's. | Implement what GAS *can*: domain check via `Session.getActiveUser()`, per-user rate limit via `CacheService`, reCAPTCHA only on **public** endpoints, request-ID + signature in app code. Accept that true edge filtering doesn't exist. |
| 12 layers as tiers | 12 network hops | **One execution runs all of them as nested calls.** | Layers are **module boundaries in code**, executed in-process. One round-trip per user action — preserve the latency work already done. |
| Data Storage "DBs" | Real databases, ACID | **Sheets: no transactions, no FK, no real indexes, 10M-cell cap, ~O(n) scans.** | "DBs" = separate **spreadsheets**; "tables" = tabs. Transactions simulated via `LockService` + append-only ledger + idempotency keys. Index tabs are manual. Hard cap governs partitioning. |
| Workflow engine | Durable orchestrator | **No durable timers, ~6-min cap, no background daemons.** | Workflow = a **status state-machine stored in rows** + time-driven triggers for scheduled steps. No long-running processes. |

**Governing principle:** the layers below are *how the code is organized and called*, not how
many servers a request crosses. Every user action = **one** `google.script.run` execution that
flows Frontend→Gateway→Security→Workflow→Module→Core→Repo→Sheets→Audit **in-process**, returns once.

---

## 1. Project topology (Libraries + module web apps)

Built on the locked decisions from `ARCHITECTURE_UNIFIED.md` (Core = Apps Script **Library**,
one web-app per module, shared Auth + per-module data). The enterprise version adds more
shared libraries and more modules.

```
        ┌─────────────────────── BOSSS KERNEL  (one published library, no doGet) ───────────────────────┐
        │  Auth·Session·Token │ Permissions(RBAC+ABAC) │ Workflow │ Audit·Logging │ Events             │
        │  Cache·Lock·Id·Config │ Notifications·Email·File·Pdf │ Repo·Mapper·Validate·Errors·Integration │
        └───────────────────────────────────────┬───────────────────────────────────────────────────────┘
                          addLibrary "Kernel"     │  (in-process, ONE versioned pin per module)
   ┌──────────┬──────────┬──────────┬────────────┼──────────┬──────────┬──────────┬──────────────────┐
   ▼          ▼          ▼          ▼            ▼          ▼          ▼          ▼                  ▼
 Inventory  Sales   Purchasing   HR        Finance    Operations  Reports    Admin          Dealer.Portal
 (web app)  (web)   (web app)    (web)     (web app)  (web app)   (web app)  (admin)        (PUBLIC web app)
   │ each: webapp.gs · api.gs(Gateway dispatcher) · services · repositories · mappers · config · React UI
   ▼
 reads/writes its DB spreadsheet(s) via Kernel.Repo / Kernel.DB.open(handle)
```

**One Kernel, not three libraries** (§0.1): one version-pin per module, lower cross-call
overhead, still namespaced internally. **Operations is a first-class module** (§0.4).
Why a library at all (not one mega-project, not HTTP service): **independent deploy + isolated
6-min budget + isolated Stackdriver per module**, with shared logic centralized and in-process
(no network/cold-start per call; see unified doc §2).

---

## 2. Layer-by-layer design (your 01–12, GAS-shaped)

### 01 Identity & Access
- **Google Workspace as IdP**: `executeAs: USER_DEPLOYING` + `Session.getActiveUser().getEmail()`
  gives a verified Workspace identity for internal apps. Restrict `access` to `DOMAIN`.
- **MFA**: enforced at the **Workspace admin** level (not in app code) — this is the *correct*
  place and is genuinely enterprise-grade.
- **App-level identity** still issues a session token (for public/dealer portal where Workspace
  login doesn't apply, and to carry app roles). Stored in `BOSSS_AUDIT_DB.login_logs`.
- RBAC + ABAC + branch + department: see Authorization (§06-sec). Device/session tracking →
  `Sessions` + `login_logs`.

### 02 Frontend Layer
Each app = its own React single-file bundle (current Vite pattern). Admin, Inventory, Sales,
Purchasing, HR, Reports = `access: DOMAIN`. Dealer/order portal = `access: ANYONE` (public,
hardened — see Edge). Mobile/PWA = same bundles with PWA manifest. **No shared localStorage
across app origins** → SSO via token hand-off launcher (unified doc §5).

### 03 Edge Security Layer — *what GAS can and cannot do*
| Control | Feasible on GAS? | How |
|---|---|---|
| Allowed-domain validation | ✅ | `Session.getActiveUser().getEmail()` domain check; `access: DOMAIN`. |
| CSRF token | ⚠️ partial | `google.script.run` isn't a cross-site form post, so classic CSRF is low-risk; still issue a per-session request token for public POST forms. |
| reCAPTCHA | ✅ public only | Verify token server-side via `UrlFetchApp` on dealer/public endpoints. |
| Rate limiting | ✅ app-level | Per-user/IP counters in `CacheService` with TTL windows (same pattern as login throttle already built). |
| Request signature | ✅ | HMAC of payload+nonce for sensitive/public calls via `Crypto`. |
| IP/device logging | ⚠️ limited | True client IP isn't reliably available inside the GAS iframe; log user-agent + email + session id instead. **State this limitation openly.** |
| Input sanitization | ✅ | Centralized in `EasyCore.Validation`. |
| Block suspicious requests | ✅ app-level | Throttle + signature + audit; no network-edge WAF. |

> **Honest limit:** there is no infrastructure edge tier. "Edge" here = the first thing each
> `api.gs` dispatcher runs, in-process. It cannot stop traffic before it reaches your code the
> way a CDN/WAF does.

### 04 API Gateway — in-process dispatcher, not a routing service
Each module's `api.gs` exposes top-level functions, but routes them through one **dispatcher**
that applies the cross-cutting envelope uniformly:

```js
// every public RPC funnels through this — gives uniform validation, versioning, response shape
function rpc(envelope) {                       // envelope = { v, action, payload, requestId }
  return Gateway.handle(envelope, {            // Gateway lives in EasyCore
    'v1.stockIn':  { role: ['inventory','clerk'], schema: Schemas.stockIn,  fn: InventoryService.stockIn },
    'v1.listSkus': { role: ['inventory','viewer'], schema: Schemas.listSkus, fn: InventoryService.listSkus },
    // …
  });
}
// Gateway.handle: assign/echo requestId → validate schema → Security.authorize → Workflow gate
//                 → fn(ctx, payload) → wrap in standard response → Audit → return
```

- **Versioning** = `v` in the envelope + `v1.*` action keys (not URL paths).
- **Standard response**: `{ ok, data?, error?: {code,message}, requestId, v }`.
- **Schema validation** before any business logic. Centralized error handling here.

### 05 Security Layer (`EasySecurity.Library`)
`AuthService · TokenService · SessionService · RoleService · PermissionService ·
BranchAccessService · ApprovalAccessService · SecurityLogService`.

**Authorization model (RBAC + ABAC + branch + department):**
```
BOSSS_MASTER_DB
  users        : id | email | username | passwordHash | systemRole | active | created_by | updated_by | updatedAt
  roles        : roleId | module | name | rank
  permissions  : roleId | action            ← action = 'v1.stockIn' etc (capability list)
  role_grants  : userId | module | roleId
  branch_access: userId | branchId           ← ABAC dimension
  dept_access  : userId | deptId             ← ABAC dimension
```
`Security.authorize(ctx, { action, branchId?, deptId? })`:
1. resolve user from token (cached, short TTL — carried from this session's work)
2. RBAC: does any granted role for the action's module hold `action` in `permissions`?
3. ABAC: if the record carries `branchId`/`deptId`, require matching `branch_access`/`dept_access`
4. `systemRole=admin` ⇒ bypass. Every denial → `security_logs`.

### 06 Business Module Layer
`Inventory · Sales · Purchasing · HR · Finance · **Operations** · Dealer · Delivery · Supplier ·
Pricing · Reporting`. Each is its own web app depending on the **Kernel** (one pin). **All
business rules live here**, never in `api.gs`, never in repositories. Computed fields recomputed
on write. **Modules never call each other directly** — cross-module effects go through the ledger
(immediate) or `Kernel.Events` (eventual), per §0.2.

### 07 Workflow & Approval Engine (`Kernel.Workflow`)
Status state-machine stored **on the record row** (`status` column) + a transitions table.
```
States: draft → submitted → for_approval → approved → posted → (voided | cancelled) → archived
                                         ↘ rejected → draft
```
- `Workflow.transition(record, toState, ctx)` validates the edge against an **approval matrix**
  (`approvals` config: which action + amount threshold + branch needs which approver rank).
- Each transition writes an **immutable** `approval_logs` row (approverId, from, to, ts).
- Scheduled steps (e.g. auto-archive after N days) via **time-driven triggers**, not daemons.
- **No hard delete anywhere** — `void`/`cancel`/`archive` are states, enforced at repo level.

### 08 Core Platform Library (`EasyCore.Library`)
`DBService · ValidationService · AuditService · NotificationService · FileService ·
CacheService · LockService · IDService · ConfigService · BackupService · ErrorService ·
EmailService · PDFService · IntegrationService`.
- `DBService.open(handle)` = the spreadsheet registry (unified doc §4); handles map to Script
  Properties IDs (`MASTER_DB`, `TRANSACTION_DB`, `HR_DB`, …).
- `AuditService.record(before, after, ctx)` — central before/after capture (§11).
- `LockService.withLock(fn, {scope, handle})` — script-lock per project; **document-lock** for
  shared DBs (Master/Audit) to serialize cross-module writes.
- `IDService` — `Utilities.getUuid()` + human-readable doc numbers (e.g. `SO-2026-000123`) via
  a locked counter row.
- `BackupService` — daily `DriveApp` copy of each DB spreadsheet to a separate, restricted
  Drive folder (time-driven trigger).
- `PDFService` — `HtmlService`→PDF via `DriveApp`/`Slides` export for documents.

### 09 Data Access Layer
Repository pattern on top of `DBService`:
- **Sheet adapters**: one batched `getValues()` read, `Lock.withLock` write (rules already in place).
- **Transaction writer**: append to an **append-only ledger** (`stock_movements`, `cash_logs`)
  rather than mutating balances in place → balances are *derived* (read models). This is how you
  get audit + correctness without DB transactions.
- **Read models / reporting tabs**: denormalized summaries rebuilt by triggers (§reporting).
- **Index tables**: manual `id → row` or `key → ids` tabs to avoid O(n) scans on hot lookups.
- **Idempotency**: `requestId` recorded; a repeated write with the same id is a no-op (covers the
  "user double-clicked Stock In during a 5-s save" case directly).
- **Migration adapters**: repositories expose a narrow interface (`findAll/find/insert/update/...`)
  so the Sheets adapter can later be swapped for a Postgres adapter **without touching services**.

### 10 Data Storage Layer — spreadsheets as "databases", tabs as "tables"
Each "DB" is a **separate spreadsheet** (isolation, the 10M-cell cap, independent backup/locking):
```
BOSSS_MASTER_DB       users · roles · permissions · role_grants · branch_access · dept_access ·
                     branches · departments · products · suppliers · customers · dealers · settings
BOSSS_TRANSACTION_DB  sales_orders · sales_order_items · purchase_orders · purchase_order_items ·
                     purchase_receipts · stock_movements · stock_adjustments · payments · deliveries
BOSSS_HR_DB           employees · attendance · leave_requests · violations · payroll_runs · evaluations
BOSSS_FINANCE_DB      cash_logs · receivables · payables · expenses · deposits · reconciliations
BOSSS_OPS_DB         concerns · store_audits · tasks · projects · action_plans · sops · trainings ·
                     meetings · corrective_actions · five_s_checks      ← Operations (improve-the-business)
BOSSS_EVENTS          events  (eventual bus — drained by trigger; §0.2)
BOSSS_AUDIT_DB        audit_logs · login_logs · api_logs · approval_logs · error_logs · security_logs
BOSSS_ARCHIVE_DB      cold rows moved out of hot tabs to stay under cell caps
BOSSS_BACKUP_DB       daily snapshots (separate Drive folder, restricted)
BOSSS_REPORTING_DB    daily_sales_summary · inventory_summary · profit_summary · stockout_alerts ·
                     fast_slow_moving · branch_kpis
```
**Partitioning rule:** when a transaction tab approaches ~500k rows or the workbook nears the
10M-cell cap, roll old rows to `BOSSS_ARCHIVE_DB` by period. This is mandatory, not optional, at
ERP volume — call it out in capacity planning.

### 11 Governance Layer
- **Immutable audit**: `audit_logs` is append-only; Core never exposes update/delete on it.
  Every business write goes through `AuditService.record` (before/after JSON, actor, requestId).
- `approval_logs`, `user_activity`, `data change history`, `error_logs` — all append-only tabs.
- **Daily backups** + **weekly CSV export** via triggers to a separate Drive folder.
- **Access/permission review**: Admin portal report listing every `role_grant` + last login.
- **Owner dashboard**: read model over audit + KPIs.

### 12 Integration Layer (`EasyCore.IntegrationService`)
Gmail/Drive/Forms (native), Looker Studio (point at `BOSSS_REPORTING_DB`), n8n + bank/supplier/
Kyte via `UrlFetchApp` webhooks/imports, future Postgres/API behind the same `IntegrationService`
interface so callers don't change when the backend does.

---

## 3. Canonical request flow — "Sales Posted" (shows ledger-vs-event, §0.2)

The hardest case: posting a sale must **decrement stock**, **notify a manager**, and **update a
dashboard**. Naively that's "Sales calls Inventory" + three events. Correctly on BOSSS it's **one
in-process execution** that does the consistency-critical part via the **ledger**, and defers the
rest to **events** — all returning once:
```
React: rpc({ v:'1', action:'v1.postSale', payload, requestId })
  → Gateway.handle            assign/echo requestId · validate schema · standard envelope
  → Kernel.Permissions        user(cached) · RBAC 'v1.postSale' · ABAC branch match
  → Kernel.Workflow.gate      does this sale value/branch need approval? set status (draft→posted)
  → SalesService.postSale     business rules · totals
  → Kernel.Id + Kernel.Lock   doc no. SO-2026-… · DOCUMENT-lock on TRANSACTION_DB
  → Repo (txn writer)         in ONE locked txn, append BOTH:
                                · sales_order(+items) rows
                                · stock_movements (-qty) rows      ← stock decrement IS the ledger
                              (idempotent on requestId — double-click safe)
  → Kernel.Audit.record       before/after → audit_logs (append-only)
  → Kernel.Events.emit        append 'SalesPosted' to events tab        ← EVENTUAL fan-out only
  → Gateway wraps response    { ok:true, data, requestId, v:'1' }      ← returns NOW

  … later, time-driven trigger drains events:
  'SalesPosted' →  Notifications.managerAlert       (email)
                →  Reporting.markDirty               (rebuild daily_sales_summary / inventory_summary)
                →  Operations.maybeStockoutConcern   (if derived stock < reorder point → create concern/task)
```
**Why stock is correct instantly:** inventory on-hand is **derived from `stock_movements`** (§0.3),
so the `-qty` rows written in the *same locked transaction* as the sale *are* the inventory
update — atomic, no event, no 1-minute lag, no lost-event risk. The `SalesPosted` event only
drives effects that tolerate delay (alerts, dashboards, an Operations stockout concern). If losing
or delaying a reaction would make a number wrong, it goes in the ledger, **not** the event.

Note: Notifications + Reporting + Operations follow-ups are **deferred** (event drain), never
inline, to respect the 6-min cap and keep the user's round-trip fast.

---

## 4. Enterprise rule set (enforced, and *where*)

| Rule | Enforced in |
|---|---|
| No direct sheet editing | Sheets protected (Workspace) + all writes via Repo only |
| No delete — void/cancel/archive only | Workflow states; Repo exposes no hard-delete for transactional entities |
| Every write has an audit log | `Gateway.handle` wraps every mutating action in `Audit.record` |
| Sensitive actions need approval | `Workflow.transition` + approval matrix |
| Every request has a request ID | `Gateway` assigns/echoes; also the idempotency key |
| `created_by` / `updated_by` on every record | Repo base stamps from `ctx.user` |
| Every transaction has a status | Workflow state column, required by schema |
| Approval has approver id + timestamp | `approval_logs`, immutable |
| Modules never call each other directly | Ledger (immediate) or `Kernel.Events` (eventual) only — §0.2 |
| Consistency-critical effects go in the ledger, not events | §0.2 rule; events are at-least-once + idempotent, may lag ~1 min |
| Every module uses the same Kernel | one pinned library dependency |
| Every error is logged | `ErrorService` → `error_logs`; Stackdriver per project |
| Daily backup snapshot | `BackupService` time-driven trigger |
| Least-privilege access | RBAC capability lists + ABAC branch/dept scoping |

---

## 5. Repository / build layout

```
/kernel/        BOSSS Kernel  (one published library, .clasp.kernel.json)
  src/server/{auth,permissions,workflow,audit,events,cache,lock,id,config,
              notifications,email,file,pdf,repo,mapper,validate,errors,integration}.js
/modules/
  /inventory/   web app: src/client + src/server(api,services,repos,mappers,config,webapp)
  /sales/ /purchasing/ /hr/ /finance/ /operations/ /reports/ /admin/ /dealer-portal/  (same shape)
/shared/        TS contract base, React server-bridge, persisted-cache + activity-indicator (reused)
scripts/
  build.mjs   --target=<kernel|module name>
  deploy.mjs  --target=…           (versioned; auto-prune old deployments)
  pin.mjs     bump all modules to Kernel version vN     ← ONE pin, not three
  backup.mjs  / migrate.mjs        (ops)
```

---

## 6. Phased delivery (no big-bang — each phase ships standalone)

| Phase | Deliverable | Proves |
|---|---|---|
| **P0** | Extract **BOSSS Kernel** (Auth+Permissions+Repo+Cache+Lock+Audit namespaces) from today's Inventory; publish as one library; reshape Inventory as module #1 with Gateway dispatcher + audit | the Kernel + dispatcher + audit pattern on a known-good app |
| **P1** | RBAC+ABAC: `role_grants`, `branch_access`, `dept_access` in MASTER_DB; `Kernel.Permissions.authorize` | enterprise authorization |
| **P2** | `Kernel.Workflow` + approval matrix; convert Inventory deletes → void/archive; **append-only `stock_movements` (stock becomes derived)** | workflow + no-delete + ledger correctness (the §0.3 invariant) |
| **P3** | `Kernel.Events` + drain trigger; move notifications/reporting to eventual; governance (Audit everywhere, Backup, error_logs, owner dashboard) | two-tier coupling (§0.2) + compliance baseline |
| **P4** | Scaffold **Sales** (proves the ledger-decrement-on-post flow §3) + **Operations** (cheapest, biggest differentiator §0.4) | the suite scales + BOSSS identity |
| **P5** | Purchasing + HR + Finance modules | full run-the-business coverage |
| **P6** | Dealer/public portal (Edge hardening: reCAPTCHA, rate limit, signature) | safe public surface |
| **P7** | Integration (Looker, n8n, bank/supplier import) + Postgres migration adapter spike | reporting + future-proofing |

Inventory remains live and useful throughout. **Operations moved earlier (P4)** — it's the
defining BOSSS module and nearly free once Kernel Workflow+Events exist.

---

## 7. Where this is genuinely enterprise-grade — and where to be honest

**Genuinely strong on GAS:** Workspace IdP + admin-enforced MFA; append-only audit/ledger;
no-delete workflow; centralized Core; per-module isolation; least-privilege RBAC/ABAC;
idempotent writes; daily backups.

**Be honest about the ceilings (don't oversell to stakeholders):**
- **No infra edge/WAF** — "edge security" is in-process app code; it cannot drop traffic upstream.
- **No ACID transactions** — correctness comes from locks + append-only ledger + idempotency,
  not real transactions. Multi-sheet atomic writes are *best-effort*, not guaranteed.
- **Sheets scale ceiling** — 10M cells/workbook, O(n) scans; partitioning/archive is mandatory,
  and there is a volume beyond which Sheets is the wrong store (that's why the Postgres migration
  adapter exists in the design from day one).
- **Client IP / true device fingerprinting** is limited inside the GAS iframe.
- **Quotas** — `UrlFetchApp`, email, triggers, and execution-time quotas are real ceilings for
  integrations and batch jobs; budget around them.

**The design decision that makes the future safe:** the Repository interface and
`IntegrationService` are defined so the **Sheets adapter can be swapped for PostgreSQL without
touching any business module.** When you outgrow Sheets, you migrate the Data Access Layer, not
the ERP.

---

## 8. Open questions before P0

1. **Identity for internal apps:** Workspace-only (`access: DOMAIN`, no app password) *or* keep
   app-managed passwords too? (Workspace-only is cleaner + gets MFA for free.)
2. **Branch/department model:** how many branches, and is access strictly hierarchical
   (region→branch) or flat?
3. **Approval matrix shape:** by amount threshold, by document type, by branch, or a combination?
4. **Doc-number scheme:** per-module, per-branch, per-year sequences? (drives `IDService` design)
5. **Volume estimate:** rough rows/day for sales + stock movements → sets the partition/archive
   cadence and whether Postgres is 12 months out or 36.
6. **Postgres timing:** design the adapter now (cheap) but when do you expect to need it?
```
