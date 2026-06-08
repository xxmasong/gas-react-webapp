# P0b — Gateway dispatcher + Audit (server-internal)

**Goal:** every Inventory RPC routes through a `Kernel.Gateway` wrapper that uniformly
applies a **requestId**, **standard error normalization**, and **append-only audit logging on
mutations** — without changing the client, `types.ts`, or the 26-function contract.

Builds on P0a (Kernel library proven). Decisions (locked):
1. **Gateway as a wrapper** — keep all 26 named `api.js` functions + contract/mock/verify tooling.
2. **Server-internal only** — each function still returns its current shape; client & `types.ts` unchanged.
3. **Audit mutations only** — writes logged to `BOSSS_AUDIT_DB.audit_logs`; reads not audited.

---

## 1. What's new in the Kernel

Two new namespaces (new top-level globals, per the P0a library rule — named to match `Kernel.X`):

### `Kernel.Gateway` (`gateway.js` → `var Gateway`)
The in-process request wrapper. One entry point used by every api.js shim:

```js
// ctx: { token, action, role?, audit?: { entity, op, idOf?, before? } }
// fn:  () => <service result>     (the existing delegate)
Kernel.Gateway.handle(ctx, fn)
```

`handle` does, in order:
1. **requestId** — assign `Kernel.Uuid.generate()` (or echo `ctx.requestId` if the client sent one later).
2. **auth** — if `ctx.role`, `Kernel.Auth.requireRole(ctx.token, ctx.role)`; else if a token is expected, `requireUser`. (login stays outside the gateway.)
3. **idempotency hook (stub for P0b)** — reserved; no-op now, real in P2.
4. **run** `fn()`.
5. **audit (mutations only)** — if `ctx.audit`, write a row to `Kernel.Audit` with actor, action, before/after, requestId. Best-effort: an audit failure must NOT fail the user's operation (logged to Stackdriver).
6. **error normalization** — catch, ensure `AppError`-shaped `{code,message}`; rethrow so `google.script.run` surfaces it to the client exactly as today. (Server-internal envelope: we do NOT wrap the success payload — return shape unchanged.)

> Reads call `handle` too (for requestId + uniform auth + error shape) but pass no `ctx.audit`, so nothing is written.

### `Kernel.Audit` (`audit.js` → `var Audit`)
Append-only writer to the audit workbook.

```js
Kernel.Audit.record({ actor, action, entity, op, before, after, requestId })
```
- Sheet: `BOSSS_AUDIT_DB.audit_logs` via `Kernel.Sheets` registry (handle `AUDIT`).
- **Append-only** — `Audit` exposes no update/delete. Uses `Kernel.Lock.withLock({scope:'document', handle:'AUDIT'})`.
- For P0b the audit workbook id is a new Script Property `AUDIT_SPREADSHEET_ID`; if unset, **default to the auth workbook** (avoid creating yet another spreadsheet during P0b) OR auto-create `BOSSS Audit (do not share)` — pick in review (see Open questions).

**`audit_logs` columns:**
`id | ts | actor | action | entity | op | recordId | before | after | requestId`
(`before`/`after` are JSON strings; `op` ∈ add|update|delete|stock|role|active|password|reseed.)

### `Kernel.Sheets` gains the `AUDIT` handle
Add `AUDIT: 'AUDIT_SPREADSHEET_ID'` to the registry's `PROP` map (defaulting per the decision above).

---

## 2. What changes in Inventory (api.js only)

Every function body changes from *direct delegate* to *gateway-wrapped delegate*. Signatures,
names, count (26), and return shapes are **identical** — so client, `types.ts`, `server.ts`,
`serverMock.ts`, and `verify:contract` are **untouched**.

**Read (no audit):**
```js
function getCategories(token) {
  return Kernel.Gateway.handle(
    { token, action: 'getCategories' },           // requireUser (default), no role, no audit
    () => CategoryService.getCategories()
  );
}
```

**Mutation (audited):**
```js
function updateInventoryItem(token, item) {
  return Kernel.Gateway.handle(
    { token, action: 'updateInventoryItem', role: _getRole().SUPERVISOR,
      audit: { entity: 'InventoryItem', op: 'update', recordId: item && item.id,
               before: () => InventoryItemService.getInventoryItem(item.id) } },
    () => { validate.inventoryItem(item); validate.string(item.id, 'id');
            return InventoryItemService.updateInventoryItem(item); }
  );
}
```
- `before` is a **thunk** so the gateway snapshots prior state only for mutations, lazily.
- `after` = the function's return value (the gateway captures it automatically).
- Validation moves *inside* the delegate (runs after auth, as today).

**Auth functions** (`login`) bypass the gateway (unauthenticated). `logout/me/changeOwnPassword`
go through with `action` set and no role.

### The 26, by treatment
| Treatment | Functions |
|---|---|
| Bypass | `login` |
| Gateway, no audit (reads / session) | `logout`, `me`, `getItems`, `getCategories`, `getInventoryItems`, `getInventorySummary`, `getCategoryTotals` |
| Gateway + audit (mutations) | `changeOwnPassword`, `registerUser`, `setUserActive`, `setUserRole`, `deleteUserAccount`, `addItem`, `updateItem`, `deleteItem`, `addCategory`, `updateCategory`, `deleteCategory`, `addInventoryItem`, `updateInventoryItem`, `deleteInventoryItem`, `bulkUpdateStock`, `saveAndVerifyStock`, `reseedInventory` |

(`changeOwnPassword` audits the *event*, never the password values.)

---

## 3. What does NOT change (scope guard)

- `src/shared/types.ts`, `src/client/**`, `server.ts`, `serverMock.ts` — untouched.
- `verify:contract` — still 26/26 (names/shapes unchanged).
- Service / repository / mapper layers — untouched.
- Return shapes to the client — identical (server-internal envelope only).
- No `rpc()` mega-function, no `{ok,data}` wrapping, no client unwrap.

---

## 4. Acceptance test (P0b)

- [ ] `typecheck:all` + `verify:contract` green (unchanged contract)
- [ ] Login, inventory load, category CRUD, stock save, role change all still work identically
- [ ] After a stock save / category edit / role change → a new row appears in `audit_logs`
      with correct actor, op, before/after, requestId
- [ ] A read (getInventoryItems) writes **no** audit row
- [ ] Forcing an audit-write error does NOT fail the underlying operation (best-effort)
- [ ] No `Kernel.Gateway`/`Kernel.Audit is undefined` in logs (library globals resolve)

---

## 5. Execution order

A. Kernel: add `audit.js` (`var Audit`) + `gateway.js` (`var Gateway`); add `AUDIT` handle to `sheets.js`. Lazy reads only (P0a rule).
B. Push Kernel (dev-mode so Inventory picks it up); cut **Kernel v2** at the end.
C. Inventory: rewrite all 26 `api.js` shims to route through `Kernel.Gateway.handle`. Add `getInventoryItem(id)` to the service if missing (needed for `before` snapshots).
D. `typecheck:all` + `verify:contract` green locally.
E. **PAUSE** → user deploys, smoke-tests, confirms `audit_logs` rows appear.
F. Pin Inventory to Kernel v2; commit P0b in both repos.

---

## 6. Open questions before P0a→P0b

1. **Audit workbook:** new `BOSSS_AUDIT_DB` spreadsheet (cleaner, matches the enterprise data layout)
   OR reuse the existing auth workbook with an added `audit_logs` tab for now (fewer moving parts in P0b)?
   *Recommend: reuse auth workbook in P0b, split to BOSSS_AUDIT_DB in P3 governance.*
2. **before-snapshot cost:** snapshotting `before` on every mutation adds a read. For `bulkUpdateStock`
   (many rows) that's N reads — acceptable, or skip `before` for bulk and log only the delta set?
   *Recommend: skip per-row `before` for bulkUpdateStock; log the update set + count.*
3. **Service `getInventoryItem(id)` / `getCategory(id)`** singular getters — add to services for `before`
   snapshots (currently only list/find exist). Small additions.
