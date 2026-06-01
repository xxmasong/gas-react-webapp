# API Contract — ServerFunctions reference

Complete reference for every RPC function callable via `google.script.run`.
The authoritative source is `src/shared/types.ts` — this doc is the human-readable companion.

All data functions take `token: string` as their first argument. The `server.ts` bridge
injects the stored token automatically — view code never passes it manually.

Minimum role is listed where it differs from "any authenticated user".

---

## Auth

| Function | Min Role | Description |
|---|---|---|
| `login(username, password)` | — | Returns `AuthSession { token, user, expiresAt }`. No token required. |
| `logout(token)` | any | Revokes the session. Returns `{ ok: true }`. |
| `me(token)` | any | Returns the current `User` or `null`. |
| `changeOwnPassword(token, currentPassword, newPassword)` | any | Changes own password. Returns `{ ok: true }`. |

---

## User management

| Function | Min Role | Description |
|---|---|---|
| `listUsers(token)` | `admin` | Returns all `User[]` (never includes password hash). |
| `registerUser(token, username, password, role)` | `admin` | Creates a new user. Returns `User`. |
| `setUserActive(token, userId, active)` | `admin` | Activates/deactivates a user. Returns updated `User`. |
| `setUserRole(token, userId, role)` | `admin` | Changes a user's role. Returns updated `User`. |
| `deleteUserAccount(token, userId)` | `admin` | Soft-deletes a user. Returns `{ id }`. |

---

## Reconciliation sessions

| Function | Min Role | Description |
|---|---|---|
| `listReconciliationSessions(token, filters?)` | `reviewer` | Returns `ReconciliationSession[]` scoped to permitted branches. |
| `createReconciliationSession(token, params)` | `ops_manager` | Creates session in `draft` status. Blocks duplicates (same branch/date/shift). |
| `openSession(token, sessionId)` | `ops_manager` | `draft → open`. |
| `submitSession(token, sessionId)` | `reviewer` | `open → submitted`. Runs completeness check. |
| `reopenSession(token, sessionId, reason)` | `admin` | `locked → reopened`. Logged in AuditLogs. |

---

## Cashier count

| Function | Min Role | Description |
|---|---|---|
| `getCashierCountForm(token, sessionId)` | `cashier` | Returns SKU list for the session. |
| `saveCashierCountLine(token, sessionId, skuId, data)` | `cashier` | Saves one SKU line; computes expected ending. |
| `submitCashierCount(token, sessionId)` | `cashier` | Locks cashier count; `submitted_at` set. |

---

## Physical count

| Function | Min Role | Description |
|---|---|---|
| `getPhysicalCountForm(token, sessionId)` | `counter` | Returns SKU list **without** expected/system qty for counter role. |
| `savePhysicalCountLine(token, sessionId, skuId, locationId, data)` | `counter` | Saves one line (sellable/damaged/expired/quarantine). |
| `submitPhysicalCount(token, sessionId)` | `counter` | Locks physical count. |
| `requestRecount(token, varianceId, assigneeId, reason)` | `reviewer` | Creates recount task; flags result. |

---

## POS import

| Function | Min Role | Description |
|---|---|---|
| `uploadPosImport(token, sessionId, rows)` | `reviewer` | Creates batch + lines; validates all rows; returns batch with accepted/rejected counts. |
| `mapPosSku(token, batchId, posCode, skuId)` | `reviewer` | Resolves SKU mapping for a flagged row. |
| `getPosImportStatus(token, sessionId)` | `reviewer` | Returns batch status and unmapped row list. |

---

## Comparison & reconciliation results

| Function | Min Role | Description |
|---|---|---|
| `runComparison(token, sessionId)` | `reviewer` | Runs 3-way engine; writes `ReconciliationResults`; transitions session to `under_review`. |
| `getReconciliationResults(token, sessionId)` | `reviewer` | Returns `ReconciliationResult[]` with classification for each SKU. |

---

## Investigation & approval

| Function | Min Role | Description |
|---|---|---|
| `assignInvestigation(token, resultId, assigneeId, dueDate)` | `reviewer` | Creates `VarianceInvestigation`. |
| `saveInvestigation(token, investigationId, data)` | assigned user | Updates reason code, remarks. |
| `uploadEvidence(token, investigationId, driveFileId, filename)` | assigned user | Links a Drive file as evidence. |
| `approveVariance(token, investigationId, approvedQty, remarks)` | `approver` | Creates approval record. Enforces self-approval restriction. |
| `rejectVariance(token, investigationId, reason)` | `approver` | Sends investigation back to `open`. |
| `listApprovalQueue(token)` | `approver` | Returns pending variances awaiting approval. |

---

## Posting

| Function | Min Role | Description |
|---|---|---|
| `postApprovedAdjustments(token, sessionId)` | `approver` | Creates `StockMovements` for all approved variances; transitions session to `posted`. Atomic — acquires script lock. |

---

## Product master

| Function | Min Role | Description |
|---|---|---|
| `getCategories(token)` | any | Returns `SkuCategory[]`. |
| `addCategory(token, cat)` | `ops_manager` | Creates category. Returns `SkuCategory`. |
| `updateCategory(token, cat)` | `ops_manager` | Updates category. Returns `SkuCategory`. |
| `deleteCategory(token, id)` | `ops_manager` | Soft-deletes category. Returns `{ id }`. |
| `getInventoryItems(token, categoryId?)` | any | Returns `InventoryItem[]`, optionally filtered by category. |
| `addInventoryItem(token, item)` | `ops_manager` | Creates SKU. Returns `InventoryItem`. |
| `updateInventoryItem(token, item)` | `ops_manager` | Updates SKU metadata (not stock — that's `postingService`). |
| `deleteInventoryItem(token, id)` | `ops_manager` | Soft-deletes SKU. |

---

## Stock (computed from ledger)

| Function | Min Role | Description |
|---|---|---|
| `getCurrentStock(token, skuId, locationId?)` | `reviewer` | Returns computed current stock for a SKU. |
| `getCurrentStockAll(token)` | `reviewer` | Returns computed stock for all SKUs. Cached. |
| `getStockCard(token, skuId, dateRange?)` | `reviewer` | Returns `StockMovement[]` history for a SKU. |

> Note: `bulkUpdateStock` and `saveAndVerifyStock` are **deprecated** and must not be used
> for new features. They violate BR-001. They will be removed once the posting service is live.

---

## Reports & summary

| Function | Min Role | Description |
|---|---|---|
| `getInventorySummary(token)` | any | Returns `InventorySummary` KPIs. |
| `getCategoryTotals(token)` | any | Returns `CategoryTotal[]`. |
| `getVarianceReport(token, filters)` | `reviewer` | Returns variance report rows. |
| `getAccountabilityReport(token, filters)` | `ops_manager` | Staff variance summary. |
| `getAuditLog(token, filters)` | `auditor` | Returns `AuditLog[]`. |

---

## Data management

| Function | Min Role | Description |
|---|---|---|
| `reseedInventory(token)` | `admin` | Re-runs the Product Info sheet migration. Returns `{ categories, items }`. |
