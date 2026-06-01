# Data model — Google Sheets as the database

The backend "database" is a single Google Spreadsheet bound to the Apps Script
project. Each **entity is one tab (sheet)**; the **header row is the schema**.

> **Foundational rule (BR-001 / BR-002):** Current stock is never stored as a
> mutable field. It is always **computed from `StockMovements`**. Any function
> that writes a quantity directly to `InventoryItems` violates this rule and must
> not exist.

---

## 1. Conventions

- **One tab per entity.** Tab name + `HEADERS` array in the repository define the schema.
- **Header row = column contract.** Row 1 is frozen; column order is positional.
- **UUID primary keys.** Generated server-side via `lib/uuid.js`. Clients never generate IDs.
- **Timestamps as ISO 8601 strings.** Sheets stores them as text; never rely on Sheets date types.
- **`id` is the lookup key.** `findRowById_` does a linear O(n) scan — fine for hundreds to low-thousands of rows.
- **Soft delete only.** No row is ever deleted. Set `deleted_at` + `deleted_by` and filter in the service layer. (BR-008)
- **Immutable audit records.** `AuditLogs` rows are never updated or soft-deleted.
- **Immutable ledger records.** `StockMovements` rows are never updated or deleted.

---

## 2. Hard limits of Sheets-as-DB (design around these)

| No… | Mitigation |
|---|---|
| Transactions | Wrap every **write** in `LockService.getScriptLock()` to serialize concurrent mutations |
| Indexes / fast lookup | Linear scans — keep tabs small; cache hot reads with `CacheService` |
| Joins | Denormalize, or join in the service layer in memory |
| Cheap per-cell I/O | Batch with `getRange().getValues()` / `setValues()` — never read/write cell-by-cell |
| Large datasets | Sheets has cell-count limits; this is app data, not analytics volumes |
| File storage | Evidence attachments are uploaded to Google Drive; only the Drive file URL is stored in `Attachments` |

---

## 3. Schema reference

### 3.1 `SkuCategories`

Product groupings. Shared across stores.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `code` | string | Short unique code, e.g. `r1f`, `hgcm` |
| `name` | string | Display name, e.g. `Syrups` |
| `packConstraint` | string | Optional pack rule, e.g. `Syrup 2.5kg - 6pc max` |
| `sortOrder` | number | Display order |
| `updatedAt` | ISO string | |
| `deleted_at` | ISO string | Soft delete |
| `deleted_by` | uuid | FK → Users.id |

### 3.2 `InventoryItems` (Product Master / SKU)

The authoritative product catalog. **Does not store current stock quantities** — those are computed from `StockMovements`.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `categoryId` | uuid | FK → SkuCategories.id |
| `store` | enum | `EASY` \| `GRUTON` |
| `sku` | string | Display name, usually emoji-prefixed |
| `emoji` | string | Extracted emoji prefix |
| `barcode` | string | Optional; unique if provided |
| `base_unit` | string | Counting unit: piece / box / kg / liter |
| `uom` | number | Units per box (pack size) |
| `costPerBoxNew` | decimal | Reference data — set by migration/sheet only |
| `costPerPieceNew` | decimal | Reference data |
| `costPerPieceOld` | decimal | Reference data |
| `sellingPriceWholesale` | decimal | EASY only |
| `sellingPriceDealer` | decimal | EASY only |
| `sellingPricePiece` | decimal | |
| `srp` | decimal | Retail price |
| `updatedAt` | ISO string | |
| `deleted_at` | ISO string | Soft delete |
| `deleted_by` | uuid | |

> `qtyGround`, `qtyUpstair`, `qtyBox`, `qtyTotal`, `qtyKyte`, `kyteMatch`, `costTotal`
> are **no longer stored fields**. They are computed by `inventoryComputationService`
> from `StockMovements` on demand and cached. The old `bulkUpdateStock` and
> `saveAndVerifyStock` RPC functions are **deprecated** — they violate BR-001.

### 3.3 `StockMovements` — The Ledger (immutable)

Every stock change, ever. This is the source of truth for inventory quantities.
**Rows are never updated or deleted.**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `sessionId` | uuid | FK → ReconciliationSessions.id (nullable for receiving/transfers) |
| `skuId` | uuid | FK → InventoryItems.id |
| `locationId` | uuid | FK → Locations.id |
| `movement_type` | enum | `receiving` \| `sale` \| `return` \| `adjustment` \| `transfer_out` \| `transfer_in` \| `damage` \| `expiry` \| `opening` |
| `qty` | decimal | Always positive; direction controlled by `movement_type` |
| `reference` | string | DR number, session ID, POS batch ID, etc. |
| `notes` | string | Optional human note |
| `created_by` | uuid | FK → Users.id |
| `created_at` | ISO string | Immutable |

Current stock = `SUM(qty WHERE movement_type adds stock) - SUM(qty WHERE movement_type removes stock)` per SKU/location.

### 3.4 `Locations`

Physical places where stock can reside.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | string | e.g. `Ground`, `Upstair`, `Box Storage`, `Damage Hold` |
| `location_type` | enum | `warehouse` \| `shelf` \| `bin` \| `damage` \| `transit` \| `quarantine` |
| `branch` | string | Branch/store identifier |
| `deleted_at` | ISO string | |

### 3.5 `ReconciliationSessions`

The parent record that owns all counts, imports, variances, approvals, and postings for one branch/date/shift.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `branch` | string | Branch identifier |
| `location_id` | uuid | FK → Locations.id |
| `date` | ISO date | `YYYY-MM-DD` |
| `shift` | string | e.g. `morning`, `afternoon`, `full` |
| `status` | enum | `draft` \| `open` \| `submitted` \| `under_review` \| `investigation` \| `recount` \| `approved` \| `posted` \| `locked` \| `reopened` |
| `assigned_users` | json | Array of user IDs assigned to this session |
| `created_by` | uuid | FK → Users.id |
| `created_at` | ISO string | |
| `posted_at` | ISO string | Set when status → `posted` |
| `locked_at` | ISO string | Set when status → `locked` |
| `reopened_at` | ISO string | Set if ever reopened |
| `reopened_by` | uuid | FK → Users.id |
| `reopen_reason` | string | Required if reopened |
| `deleted_at` | ISO string | Soft cancel |

Status transitions: `draft → open → submitted → under_review → investigation → recount → under_review → approved → posted → locked`. Reopen requires admin; is logged.

### 3.6 `CashierCounts`

One row per SKU per session. Cashier-submitted source data.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `session_id` | uuid | FK → ReconciliationSessions.id |
| `sku_id` | uuid | FK → InventoryItems.id |
| `cashier_id` | uuid | FK → Users.id |
| `opening_qty` | decimal | ≥ 0 |
| `sold_qty` | decimal | ≥ 0 |
| `return_qty` | decimal | ≥ 0 |
| `return_condition` | enum | `sellable` \| `damaged` \| `expired` — required if return_qty > 0 |
| `return_reason` | string | Required if return_qty > 0 |
| `expected_ending_qty` | decimal | System-computed: `opening - sold + return` |
| `remarks` | string | Optional |
| `submitted_at` | ISO string | Locked once set |
| `created_at` | ISO string | |

### 3.7 `PhysicalCounts`

One row per SKU per location per session. Blind count by counter.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `session_id` | uuid | FK → ReconciliationSessions.id |
| `sku_id` | uuid | FK → InventoryItems.id |
| `location_id` | uuid | FK → Locations.id |
| `counter_id` | uuid | FK → Users.id |
| `sellable_qty` | decimal | ≥ 0 |
| `damaged_qty` | decimal | ≥ 0 |
| `expired_qty` | decimal | ≥ 0 |
| `quarantine_qty` | decimal | ≥ 0 |
| `is_recount` | boolean | True if this row is a recount submission |
| `recount_reason` | string | Required if is_recount |
| `submitted_at` | ISO string | |
| `created_at` | ISO string | |

The blind count mode is enforced server-side: `getPhysicalCountForm` omits expected/system quantities for `counter` role users.

### 3.8 `PosImportBatches`

One row per uploaded POS file.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `session_id` | uuid | FK → ReconciliationSessions.id |
| `filename` | string | Original upload filename |
| `uploaded_by` | uuid | FK → Users.id |
| `uploaded_at` | ISO string | |
| `status` | enum | `pending` \| `validated` \| `imported` \| `error` |
| `row_count` | number | Total rows in file |
| `accepted_count` | number | Rows that passed validation |
| `rejected_count` | number | Rows that failed |

### 3.9 `PosImportLines`

One row per line in the POS file.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `batch_id` | uuid | FK → PosImportBatches.id |
| `pos_code` | string | POS item identifier |
| `pos_name` | string | POS item display name |
| `sku_id` | uuid | FK → InventoryItems.id — null until mapped |
| `pos_current_qty` | decimal | Quantity from POS |
| `pos_sales_qty` | decimal | Sales qty (net of voids/refunds) |
| `is_mapped` | boolean | True when sku_id is resolved |
| `validation_error` | string | Row-level error message if rejected |

### 3.10 `ReconciliationResults`

One row per SKU per session — the 3-way comparison output. Auto-generated when comparison is run.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `session_id` | uuid | FK → ReconciliationSessions.id |
| `sku_id` | uuid | FK → InventoryItems.id |
| `cashier_qty` | decimal | From CashierCounts.expected_ending_qty |
| `physical_qty` | decimal | From PhysicalCounts.sellable_qty |
| `system_qty` | decimal | From PosImportLines or StockMovements computation |
| `variance_qty` | decimal | physical - system (primary variance) |
| `variance_value` | decimal | variance_qty × costPerPieceNew (role-restricted) |
| `classification` | enum | `matched` \| `physical_shortage` \| `physical_overage` \| `cashier_mismatch` \| `system_mismatch` \| `critical` \| `incomplete` \| `system_exception` |
| `tolerance_applied` | boolean | True if within configured tolerance band |
| `created_at` | ISO string | |

### 3.11 `VarianceInvestigations`

One row per variance requiring investigation.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `result_id` | uuid | FK → ReconciliationResults.id |
| `session_id` | uuid | FK → ReconciliationSessions.id |
| `assigned_to` | uuid | FK → Users.id |
| `assigned_by` | uuid | FK → Users.id |
| `due_date` | ISO date | |
| `reason_code` | string | Required for major/critical: e.g. `theft`, `count_error`, `pos_mapping`, `unrecorded_receiving` |
| `remarks` | string | |
| `status` | enum | `open` \| `submitted` \| `escalated` \| `resolved` |
| `resolved_at` | ISO string | |
| `created_at` | ISO string | |

### 3.12 `VarianceApprovals`

One row per approval decision on a variance.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `investigation_id` | uuid | FK → VarianceInvestigations.id |
| `approver_id` | uuid | FK → Users.id |
| `decision` | enum | `approved` \| `rejected` \| `returned` |
| `approved_qty` | decimal | Final approved adjustment quantity |
| `remarks` | string | Required on rejection/return |
| `decided_at` | ISO string | |

### 3.13 `Attachments`

Evidence files linked to investigations or physical counts. The file itself lives in Google Drive.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `entity_type` | enum | `investigation` \| `physical_count` \| `goods_receipt` \| `damage_report` |
| `entity_id` | uuid | FK to the relevant entity |
| `drive_file_id` | string | Google Drive file ID |
| `file_url` | string | Drive share URL for display |
| `filename` | string | Original filename |
| `uploaded_by` | uuid | FK → Users.id |
| `uploaded_at` | ISO string | |

### 3.14 `AuditLogs` (immutable)

Every create / update / approve / post / delete / login action. Rows are never updated or deleted.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → Users.id |
| `action` | string | e.g. `approve_variance`, `post_adjustment`, `reopen_session` |
| `entity_type` | string | Table name of affected entity |
| `entity_id` | uuid | PK of affected entity |
| `old_value` | json | Previous state (optional) |
| `new_value` | json | New state (optional) |
| `ip_hint` | string | Device/session hint (GAS cannot capture real IP) |
| `created_at` | ISO string | Immutable |

### 3.15 `Users` and `Sessions`

Stored in a **separate auth workbook** (Drive ID in Script Properties — see [OPERATIONS.md](OPERATIONS.md)). Never in the main data spreadsheet.

`Users`:

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `username` | string | Unique |
| `password_hash` | string | bcrypt-equivalent; never returned to client |
| `role` | enum | `admin` \| `ops_manager` \| `reviewer` \| `approver` \| `cashier` \| `counter` \| `auditor` |
| `active` | boolean | |
| `fail_count` | number | Login failure counter |
| `locked_until` | ISO string | Lockout expiry |
| `created_at` | ISO string | |
| `deleted_at` | ISO string | Soft delete |

`Sessions`:

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK (= token) |
| `user_id` | uuid | FK → Users.id |
| `created_at` | ISO string | |
| `last_active_at` | ISO string | Updated on each call (sliding window) |
| `expires_at` | ISO string | Hard expiry (12h from creation) |
| `revoked_at` | ISO string | Set on logout |

---

## 4. P2 schemas (planned)

### 4.1 `GoodsReceipts`
Supplier deliveries. One row per delivery per SKU. Creates a `StockMovements` entry with `movement_type = receiving`.

### 4.2 `Transfers`
Internal branch/location transfers. Creates paired `transfer_out` and `transfer_in` `StockMovements` entries.

### 4.3 `DamageReports`
Damage and expiry recording. Creates a `StockMovements` entry with `movement_type = damage` or `expiry`.

---

## 5. Adding a new entity

1. Add the type + functions to `src/shared/types.ts`.
2. Define `SHEET_NAME` + `HEADERS` in a new `src/server/repositories/<name>Repository.js`.
3. Create a row mapper in `src/server/mappers/<name>Mapper.js`.
4. Implement business logic in `src/server/services/<name>Service.js`.
5. Add thin RPC shims in `src/server/api.js`.
6. Wire client wrapper + mock in `src/client/lib/server.ts`.
7. Build the feature view + hook.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full recipe.

---

## 6. Where the live data lives

Script ID, sheet IDs, and `/exec` URLs are in [DEPLOY_URL.md](DEPLOY_URL.md).
Auth workbook ID is stored in Script Properties (`AUTH_SPREADSHEET_ID`).
