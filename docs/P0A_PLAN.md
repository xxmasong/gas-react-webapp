# P0a — Extract BOSSS Kernel, prove Inventory identical

**Goal:** move shared primitives into a published `Kernel` Apps Script library; rewire today's
Inventory to call `Kernel.*`; **prove behaviour is byte-for-byte identical** (same RPCs, same UI,
`verify:contract` green). No new features. No Gateway dispatcher yet (that's P0b).

**Branch:** `feat/bosss-p0a-kernel` (off current). Working Inventory stays on `master` as fallback.
**Kernel pin:** `developmentMode:true` during P0a; pin a version at the end.
**Today's Inventory scriptId** (reused by the module): `1z_J4gESMkKVbiw8tPqlQkkrF_PKzkatNJrrXHS7ORvMqBnd-UDPtLMSR`

---

## 1. Why this is mostly *rewiring*, not moving

Today all `src/server/*.js` share one global scope, so `CategoryRepository` says bare `Cache.`,
`Lock.`, `AppError.`, `Uuid.`, `Config.`. Once those move **into** the Kernel library, library code
runs in its own scope and is reachable from Inventory only through the `Kernel.` symbol. So the work
is: change **214 references across 13 files** from bare globals to `Kernel.*`. The *logic does not
change* — only the path to it. That's why the acceptance test is "identical behaviour."

Reference counts to rewire (from grep): authService 61 · userRepository 15 · inventoryItemRepository 16 ·
api 48 · categoryRepository 13 · inventoryItemService 12 · itemRepository 12 · categoryService 8 ·
inventoryService 7 · validate 9 · webapp 7 · seedFromInventorySheet 5 · config 1.

---

## 2. Target repo structure

```
/kernel/
  src/server/
    namespace.js     ← defines `var Kernel = (function(){ … })()` aggregator (load order matters)
    cache.js  lock.js  uuid.js  datetime.js  errors.js  crypto.js  validate.js
    sheets.js        ← NEW  registry: open(handle) / sheet(handle, tab, headers)
    repo.js          ← NEW  base: findAllRows / findRowIndexById / upsertRow / deleteRow
    auth.js          ← from services/authService.js
    userRepo.js      ← from repositories/userRepository.js (internal to auth)
    config.js        ← Kernel-owned config ONLY (auth policy, roles, auth workbook name/prop)
  appsscript.json    ← library manifest (NO webapp block)
  .clasp.kernel.json ← scriptId from `clasp create` (you run)

/modules/inventory/
  src/client/        ← moved verbatim from src/client (no logic change)
  src/server/
    api.js  webapp.js
    config.js          ← Inventory config ONLY (sheets, cache TTLs/keys, stores) — auth keys removed
    services/{inventoryItemService,categoryService,inventoryService,summaryService}.js
    repositories/{inventoryItemRepository,categoryRepository,itemRepository}.js
    mappers/{inventoryItemMapper,categoryMapper,itemMapper}.js
    migration/seedFromInventorySheet.js
    contract.ts        ← moved from src/server/contract.ts
  appsscript.json    ← webapp block + Kernel library dep (developmentMode:true)
  .clasp.inventory.json ← REUSES today's scriptId (1z_J4g…)

/shared/             ← src/shared/types.ts moves here (imported by client + contract)
scripts/             ← build/deploy/copy-server parameterised: --target=kernel|inventory
docs/                ← unchanged
```

---

## 3. Kernel public surface (P0a scope only)

```
Kernel
 ├─ Cache      get, set, remove, getOrSet
 ├─ Lock       withLock(fn, opts?)        ← opts.scope: 'script'(default) | 'document'(+handle)
 ├─ Uuid       generate
 ├─ DateTime   nowIso
 ├─ AppError   validation, notFound, conflict, unauthorized
 ├─ Crypto     hashPassword, verifyPassword, randomToken
 ├─ Validate   required, string, number, array, enumOf, …  (primitives only)
 ├─ Sheets     open(handle) → Spreadsheet,  sheet(handle, tab, headers) → Sheet     [NEW]
 ├─ Repo       findAllRows, findRowIndexById, upsertRow, deleteRow                   [NEW, opt-in]
 ├─ Auth       login, logout, me, userFromToken, requireUser, requireRole,
 │             changeOwnPassword, listUsers, registerUser, setUserActive,
 │             setUserRole, deleteUserAccount, seedFirstAdmin, seedUsers
 └─ Config     AUTH (policy), ROLES, AUTH_WORKBOOK_NAME, AUTH_SPREADSHEET_ID_PROP
```

Notes:
- **`Kernel.Repo` is added but Inventory does NOT adopt it in P0a** — its repositories keep their
  current bodies (rewired to `Kernel.Cache/Lock/...`). Adopting Repo base is a later, separate change
  so it can't muddy the "identical" proof.
- **`Kernel.Sheets`** replaces `SpreadsheetApp.getActiveSpreadsheet()` — but for P0a it can default the
  `DATA` handle to the active spreadsheet so Inventory behaves exactly as today (the registry hardening
  is P1/P4). Stated so we don't over-scope.

---

## 4. The config split (the one non-mechanical decision)

Today's `config.js` mixes Inventory and auth concerns. It splits:

| Key | Goes to |
|---|---|
| `SHEETS.items/categories/inventoryItems` | **Inventory** config |
| `SHEETS.users/sessions` | **Kernel** config |
| `CACHE_TTL`, `CACHE_KEYS` (items/categories/inventory) | **Inventory** config |
| `AUTH` (idle/abs TTL, password policy, lockout) | **Kernel** config |
| `STORES`, `DEFAULT_STORE` | **Inventory** config |
| `ROLES` | **Kernel** config (Auth owns roles); Inventory reads `Kernel.Config.ROLES` |
| `AUTH_WORKBOOK_NAME`, `AUTH_SPREADSHEET_ID_PROP` | **Kernel** config |

Inventory code that currently reads `Config.ROLES` → reads `Kernel.Config.ROLES`. Everything else in
Inventory keeps reading its own local `Config`.

---

## 5. Rewiring rules (applied uniformly across the 13 files)

| Today (bare global) | Becomes |
|---|---|
| `Cache.X` | `Kernel.Cache.X` |
| `Lock.withLock(...)` | `Kernel.Lock.withLock(...)` |
| `Uuid.generate()` | `Kernel.Uuid.generate()` |
| `DateTime.nowIso()` | `Kernel.DateTime.nowIso()` |
| `AppError.X(...)` | `Kernel.AppError.X(...)` |
| `Crypto.X(...)` | `Kernel.Crypto.X(...)` |
| `Config.ROLES` | `Kernel.Config.ROLES` |
| `Config.AUTH` (auth files only) | `Kernel.Config.AUTH` |
| `AuthService.requireRole(...)` (in api.js) | `Kernel.Auth.requireRole(...)` |
| `validate.string(...)` etc. (primitive checks) | `Kernel.Validate.string(...)` |
| `validate.inventoryItem(...)` (domain validator) | **stays in Inventory**, built on `Kernel.Validate` |

Inventory's own `Config.SHEETS/CACHE_*/STORES` references are **unchanged** (still local).

---

## 6. Build/deploy changes

`copy-server.mjs` and `deploy.mjs` gain `--target`:
- `--target=kernel` → assemble `/kernel/src/server` → push to Kernel scriptId. **No web-app deploy**
  (libraries aren't deployed as web apps; they're pushed + version-published).
- `--target=inventory` → build React + assemble `/modules/inventory/src/server` → push to Inventory
  scriptId → versioned web-app deploy (existing flow, now path-adjusted).

`verify-contract.mjs` points at `/modules/inventory` paths. `tsconfig.*` roots updated.

---

## 7. Exact commands you (the user) run — I pause and hand these to you

After I scaffold `/kernel` (step B below), you run:

```bash
# 1. Create the Kernel GAS project (standalone, not sheets-bound)
cd kernel
npx clasp create --type standalone --title "BOSSS Kernel"
#   → writes .clasp.json here; note the scriptId it prints

# 2. Push the Kernel source
npx clasp push -f

# 3. Get the Kernel scriptId (for Inventory's appsscript.json)
cat .clasp.json    # copy "scriptId"
```

Then tell me the Kernel scriptId; I write it into `/modules/inventory/appsscript.json` as the library
dependency (`userSymbol:"Kernel"`, `developmentMode:true`). After I finish rewiring, you run:

```bash
# 4. Deploy Inventory (module) and smoke-test
npm run deploy:version --target=inventory
```

(Library dependencies in dev mode are picked up automatically on each Inventory push — no version bump
needed during P0a.)

---

## 8. Acceptance test — "identical behaviour" (the safety net)

P0a is DONE only when all pass, matching pre-P0a behaviour:
- [ ] `npm run typecheck:all` green (client + server contract)
- [ ] `npm run verify:contract` green — 26 RPCs on all 4 surfaces
- [ ] Login works (admin)
- [ ] Inventory list loads; category list loads
- [ ] One stock save (saveAndVerifyStock) → green check, value persists
- [ ] One category add + edit
- [ ] One user role change (optimistic + server)
- [ ] Header activity indicator + persisted cache still behave as today
- [ ] No `X is not defined` errors in `npm run logs` (catches missed rewires / Kernel load order)

If any fail: the bug is in the **extraction/rewiring**, not new logic — bisect within P0a only.

---

## 9. Execution order (what I do, in sequence)

A. Create branch `feat/bosss-p0a-kernel`.
B. Scaffold `/kernel` (move + namespace lib/auth files, add Sheets/Repo, split config). **PAUSE → you run §7 steps 1–3.**
C. You give me the Kernel scriptId.
D. Move client/server into `/modules/inventory`; rewire all 214 refs to `Kernel.*`; split Inventory config; wire library dep.
E. Parameterise build/deploy/verify/tsconfig by target.
F. `typecheck:all` + `verify:contract` green locally. **PAUSE → you run §7 step 4 + §8 smoke test.**
G. On green: flip Kernel `developmentMode:false`, publish Kernel v1, pin Inventory to it. Commit.

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Missed bare-global rewire → runtime `X is not defined` | grep sweep for each moved symbol after rewiring; §8 logs check |
| Kernel internal load order (IIFE before use) | `namespace.js` aggregates in dependency order: errors→uuid→datetime→crypto→cache→lock→validate→sheets→repo→userRepo→auth |
| Library call overhead on hot paths | acceptable; auth session-cache + throttle from this session move into Kernel and absorb it |
| `clasp` library setup friction | dev-mode dependency avoids version bumps during iteration; commands in §7 are exact |
| Big restructure hard to review | this doc + a single squashed "P0a: extract Kernel" commit with the move + rewire separated in the diff |

---

## What P0a explicitly does NOT do (guard against scope creep)
- No Gateway dispatcher / rpc envelope (P0b)
- No Audit wrapping (P0b)
- No RBAC/ABAC, branch/dept (P1)
- No Workflow, ledger conversion (P2)
- No Events (P3)
- Inventory repositories do NOT adopt `Kernel.Repo` base yet (later)
- `Kernel.Sheets` registry stays default-to-active (hardening later)
