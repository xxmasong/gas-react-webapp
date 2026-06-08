# P1 — RBAC + ABAC (per-module roles + branch access)

**Goal:** replace the single global role with **per-module role grants** plus a **branch** access
dimension, sourced from a new `BOSSS_MASTER_DB`, enforced by `Kernel.Permissions` — **without
breaking the working app** (dual-read fallback to today's `Users.role` until migration is done).

Decisions (locked):
1. **Branches only** — `branch_access` enforced; `dept_access` stubbed (schema reserved, not enforced).
2. **`systemRole` ∈ `superadmin | admin | none`** + per-module grants (see §0 for superadmin).
3. **New `BOSSS_MASTER_DB`, dual-read** — `authorize()` checks grants, falls back to `Users.role` when none exist; flip off fallback after migration.
4. **Approval matrix deferred to P2.**

---

## 0. Superadmin — the system/dev-ops identity (config-only, exactly one)

A distinct identity *axis* from business roles: **superadmin configures the platform and does NOT
operate the business** (separation of duties — the dev-ops account never touches stock/inventory/
sales data, so platform changes and business actions have separate accountable identities).

| | superadmin | admin | per-module grant |
|---|---|---|---|
| System configuration (§0.1) | ✅ ONLY it | ❌ | ❌ |
| Business operations (stock, inventory, categories, …) | ❌ (blocked) | ✅ all | ✅ per grant |
| User management (create/role business users) | via config | ✅ | ❌ |
| Count | **exactly 1** | many | many |

### 0.1 What superadmin configures (and admin cannot)
- **Identity & access config:** branches, departments, role definitions, the role/permission matrix, feature flags.
- **Platform/infra:** Script Properties (spreadsheet IDs, version-pin config), cache TTLs, auth policy (lockout/password rules), audit-DB management.
- **Migrations & dangerous ops:** `bootstrapMasterDb`, `migrateInventoryGrants`, reseed, data-fix scripts, the dual-read fallback flip.
- **Module registry:** which modules exist/are enabled, module version pins, the module catalog (as HR/Sales/… come online).

### 0.2 Enforcement & provisioning
- **`systemRole='superadmin'`** on exactly one user. The system **hard-refuses to create a second**
  (`Kernel.Auth` checks: if a superadmin exists, any attempt to set/create another throws).
- **Bootstrap-only:** created via a Kernel editor function `bootstrapSuperadmin(username, password)`
  — refuses if one already exists. **Never** creatable or editable through the normal Users UI; the
  Users UI neither lists nor allows assigning `superadmin`.
- **Cannot be deleted/deactivated/demoted by admin** (only by another superadmin, of which there are
  none-but-one → effectively requires the bootstrap/recovery path).
- Stored as a row in the auth `Users` sheet with `systemRole='superadmin'`; the singleton invariant
  is enforced in code, and the username is also recorded in a Kernel Script Property
  `SUPERADMIN_USERNAME` as a tamper-evident pointer.

### 0.3 authorize() treatment
- `systemRole==='superadmin'` ⇒ allowed for **config actions** (`ctx.config===true`), **denied** for
  business actions (any `ctx.module` business op) unless explicitly also granted (it normally isn't).
- `systemRole==='admin'` ⇒ allowed for business + user-mgmt; **denied** for config actions.
- Config-surface RPCs carry `ctx.config = true` (instead of `ctx.module`); the gateway routes those
  to a `Permissions.requireSuperadmin(user)` check.

---

## 1. Data model — `BOSSS_MASTER_DB` (new spreadsheet, handle `MASTER`)

```
branches      : id | code | name | active | updatedAt
role_grants   : id | userId | module | role | createdAt        ← RBAC: (who, which module, what role)
branch_access : id | userId | branchId | createdAt              ← ABAC: which branches a user may touch
dept_access   : id | userId | deptId | createdAt                ← RESERVED (not enforced in P1)
```

- `module` ∈ `'inventory'` (today) … `'hr' | 'sales' | …` (future). A user can hold different roles
  per module: `(u, 'inventory', 'supervisor')`, `(u, 'hr', 'viewer')`.
- `role` reuses the existing ladder values (`inventory_staff | supervisor | admin`) **per module**.
  (Module-specific ladders can come later; P1 keeps the shared 3-tier ranks.)
- **`systemRole`** lives on the existing `Users` sheet (already has a `role` column → repurpose:
  see migration §4). `systemRole=admin` ⇒ bypass all checks.
- Branch dimension ties to existing store reality (EASY / GRUTON) — but branches are their own
  entity (a store can have multiple branches later); `InventoryItem.store` is NOT a branch yet
  (kept separate; wiring inventory rows to branchId is a later, optional step).

`BOSSS_MASTER_DB` id stored in Script Property **`MASTER_SPREADSHEET_ID`** on the **Kernel**
project (per the P0b lesson: library reads its own props). Bootstrap function creates it + seeds.

---

## 2. Kernel changes — `Kernel.Permissions` (`permissions.js` → `var Permissions`)

New public global. Reads `MASTER` via `Kernel.Sheets`, cached like sessions.

```js
// ctx already carries the resolved user (gateway passes it). target optional.
Kernel.Permissions.authorize(user, { module, role, branchId?, config? })
Kernel.Permissions.requireSuperadmin(user)   // for config-surface actions
```
Order:
0. **Config actions** (`config===true`): allow **iff** `user.systemRole==='superadmin'`, else deny.
   (superadmin is denied non-config business `module` actions — separation of duties, §0.3.)
1. `user.systemRole === 'admin'` ⇒ allow business + user-mgmt (NOT config).
2. **RBAC:** does `role_grants` contain `(user.id, module, r)` with `rank(r) >= rank(role)`?
   - **Dual-read fallback:** if the user has *no grants at all for `module`*, fall back to the
     legacy `user.role` rank (today's behaviour). Controlled by a Kernel flag
     `PERMISSIONS_FALLBACK` (Script Property, default `'on'` in P1).
3. **ABAC (branch):** if `branchId` given, require `(user.id, branchId)` in `branch_access`
   (admin/systemRole bypasses; users with *no* branch_access rows = "all branches" during
   transition, configurable).
4. Deny ⇒ `Kernel.AppError.unauthorized(...)`. (Denials can log to audit/security later.)

Helpers: `Kernel.Permissions.grantsFor(userId)`, `branchesFor(userId)`, `listBranches()`,
plus admin mutators `grantRole/revokeRole/grantBranch/revokeBranch` (used by the Users UI in §5).

Caching: grants+branches per user cached ~30–60s (same pattern as the session cache), invalidated
on any grant/branch mutation for that user.

---

## 3. Gateway integration — `ctx.module` + `ctx.branchId`

The Gateway already does `requireRole`. P1 evolves that: when `ctx.module` is present, it calls
`Permissions.authorize(user, { module, role: ctx.role, branchId: ctx.branchId })` instead of the
flat `requireRole`. Backward-compatible: functions without `ctx.module` keep the old `requireRole`
path (so non-inventory/admin functions like user-management are unaffected).

```js
// api.js — inventory mutation, P1 form
function updateInventoryItem(token, item) {
  return Kernel.Gateway.handle(
    { token, action: 'updateInventoryItem',
      module: 'inventory', role: _getRole().SUPERVISOR,    // RBAC: inventory-supervisor+
      // branchId: item.branchId,                          // ABAC: enable once items carry branch
      audit: { entity: 'InventoryItem', op: 'update', recordId: item && item.id,
               before: () => InventoryItemService.getInventoryItem(item.id) } },
    () => { validate.inventoryItem(item); validate.string(item.id, 'id');
            return InventoryItemService.updateInventoryItem(item); }
  );
}
```

User-management functions (`listUsers`, `setUserRole`, …) stay `role: ADMIN` (no `module`) — they
gate on `systemRole=admin`, which is correct. **Config-surface** functions (branches, grants,
settings, migrations) carry `ctx.config=true` → `requireSuperadmin`.

---

## 4. Migration (dual-read makes this safe)

1. Create `BOSSS_MASTER_DB` + set `MASTER_SPREADSHEET_ID` (Kernel `bootstrapMasterDb()`).
2. **`systemRole` column:** add an explicit `systemRole` column to the `Users` sheet (needed because
   `superadmin` must be stored, not derived). Migration backfills it: legacy `role==='admin'` ⇒
   `systemRole='admin'`, everyone else ⇒ `systemRole='none'`. `Kernel.Auth` returns `user.systemRole`
   from this column. The legacy `role` column stays (it's the per-user default the dual-read fallback
   uses) until fallback is flipped off.
   - **Superadmin** is created separately by `bootstrapSuperadmin(username, password)` (§0.2) →
     writes a Users row with `systemRole='superadmin'`; refuses if one exists.
3. **Seed branches:** insert `EASY`, `GRUTON` (and any real branches) into `branches`.
4. **Backfill grants:** for each non-admin, non-superadmin user, write
   `(userId, 'inventory', <their legacy role>)` into `role_grants`, and `branch_access` rows as
   appropriate. A one-time `migrateInventoryGrants()` Kernel function does this from the current Users.
5. **Verify** every active user can still do what they could before (dual-read means they can even
   *before* backfill — fallback covers them).
6. **Flip fallback off** (`PERMISSIONS_FALLBACK='off'`) once grants are confirmed — now grants are
   authoritative.

At no point is the app broken: pre-backfill, fallback uses legacy role; post-backfill, grants match;
the flip is the only "cutover" and it's reversible.

---

## 5. UI (Users screen) — manage grants + branches

Extend the existing `/users` admin screen:
- Per user: list module role-grants (add/remove), list branch access (add/remove).
- New RPCs (contract additions — types.ts + server.ts + serverMock.ts, same commit):
  `listBranches`, `getUserGrants(userId)`, `setUserModuleRole(userId, module, role)`,
  `revokeUserModuleRole(userId, module)`, `grantUserBranch(userId, branchId)`,
  `revokeUserBranch(userId, branchId)`. All `systemRole=admin` only, all audited.
- This is the **only part of P1 that touches the client contract** (new admin RPCs). Inventory's
  existing 26 are unchanged in shape.

> P1 can ship the **server/Kernel side first** (authorize + dual-read + migration) and add the UI
> in a follow-up — the grants can be seeded by the migration function without UI initially.

---

## 6. What does NOT change

- The 26 existing RPC return shapes; client hooks for inventory/categories.
- Login/session flow (still `Kernel.Auth`); `me` still returns the public user.
- Gateway/audit from P0b (P1 extends the auth step, keeps audit).
- Service/repository/mapper layers.

---

## 7. Acceptance test

- [ ] `BOSSS_MASTER_DB` created; branches seeded; `MASTER_SPREADSHEET_ID` set on Kernel.
- [ ] With fallback ON and no grants: app behaves exactly as today (every role works as before).
- [ ] After `migrateInventoryGrants()`: `role_grants` has a row per non-admin user; behaviour identical.
- [ ] A user granted `(u,'inventory','inventory_staff')` can do stock saves but NOT supervisor actions.
- [ ] `systemRole=admin` can do everything regardless of grants.
- [ ] Flip fallback OFF: a user with no grant for inventory is correctly denied (proves grants authoritative).
- [ ] branch_access: a user restricted to one branch is denied a `branchId` they lack (once a
      branch-scoped action exists; otherwise verified via a Permissions unit check).
- [ ] `typecheck:all` + `verify:contract` green (new admin RPCs present on all 4 surfaces).
- [ ] Grant/branch mutations write audit rows.
- [ ] `bootstrapSuperadmin` creates the superadmin; a 2nd attempt is **refused** (singleton).
- [ ] superadmin can run config actions (branches/grants/settings); is **denied** a business op
      (e.g. stock save) — separation of duties holds.
- [ ] admin can do business + user-mgmt but is **denied** a config action.
- [ ] superadmin is not listed/assignable in the Users UI; admin cannot delete/demote it.

---

## 8. Execution order

A. Kernel: `permissions.js` (`var Permissions` — `authorize` + `requireSuperadmin` + helpers);
   `Auth` gains `systemRole` support + singleton-superadmin guard. Bootstrap/migrate functions
   (`bootstrapMasterDb`, `bootstrapSuperadmin`, `migrateSystemRoles`, `migrateInventoryGrants`).
   Lazy reads; pin **Kernel v5**.
B. Kernel: Gateway routes `ctx.config` → `requireSuperadmin`; `ctx.module` → `Permissions.authorize`;
   else legacy `requireRole`.
C. Inventory: add `module:'inventory'` to inventory api.js shims (not user-mgmt). Contract unchanged.
D. **PAUSE** → superadmin runs (in Kernel editor): `bootstrapSuperadmin` (once) → `bootstrapMasterDb`
   → `migrateSystemRoles` → `migrateInventoryGrants`; verifies dual-read; then flips fallback off.
E. UI: config RPCs (branches/grants/settings — superadmin) + Users-screen grant/branch mgmt (admin);
   contract additions; may be a follow-up.
F. Pin Inventory to Kernel v5; commit P1 both repos.

---

## 9. Open questions (resolve during build, not blocking the plan)

1. **"No branch_access rows" semantics:** treat as "all branches" (transition-friendly) or "no
   branches" (strict)? *Recommend all-branches during P1 transition, tighten later.*
2. **Do inventory rows get a `branchId`** in P1 (enabling real branch-scoped reads/writes), or is
   branch_access enforced only on future branch-bearing entities? *Recommend defer item-branch
   wiring; P1 builds the mechanism, a later step tags inventory rows.*
3. **Superadmin recovery:** if the one superadmin is lost (forgotten password / deleted row), recovery
   is a Kernel editor function (`resetSuperadmin`) — editor access to the Kernel project IS the
   ultimate root of trust. Acceptable (only you have that). Confirm during build.
4. **Superadmin & user-management:** can superadmin create the *first* admin (chicken-and-egg before
   any admin exists)? *Recommend yes — user-provisioning counts as identity config, so superadmin
   may create/assign business admins; it just can't do business data ops.*
