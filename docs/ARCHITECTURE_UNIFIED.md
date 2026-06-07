# Unified Standalone System — Architecture

Status: **proposal** · Target: convert the single Inventory GAS app into a multi-module
suite (HR · Inventory · Accounting …) sharing one **Core** Apps Script Library,
one central **Auth**, and per-module data spreadsheets.

Decisions locked (see "Decisions" at bottom):
1. **Core = Apps Script Library** — modules call `Core.*` in-process.
2. **One web-app per module** — each module is its own GAS project, deployment, URL, React bundle.
3. **Shared Auth + per-module data** — one Auth workbook; each module owns its data spreadsheet(s); shared Master/reference workbook.

---

## 1. System topology

```
                         ┌───────────────────────────────────────────┐
                         │            CORE  (Apps Script Library)      │
                         │  published script project, versioned dep    │
                         │                                             │
                         │  Auth · Session · RBAC · Crypto             │
                         │  Sheets access (openById registry)          │
                         │  Cache · Lock · Uuid · DateTime · Errors    │
                         │  Repository/Mapper BASE helpers · Validate  │
                         └───────────────┬─────────────┬───────────────┘
                              addLibrary  │   addLibrary │  addLibrary
            ┌─────────────────────────────┼─────────────┼─────────────────────────────┐
            ▼                             ▼             ▼                             ▼
   ┌─────────────────┐         ┌─────────────────┐   ┌─────────────────┐
   │  HR  (web app)  │         │ INVENTORY (web) │   │ ACCOUNTING (web)│   … more modules
   │  doGet→React    │         │  doGet→React    │   │  doGet→React    │
   │  api.gs (thin)  │         │  api.gs (thin)  │   │  api.gs (thin)  │
   │  hr services    │         │  inv services   │   │  acc services   │
   └────────┬────────┘         └────────┬────────┘   └────────┬────────┘
            │ Core.Sheets.open(…)        │                     │
            ▼                            ▼                     ▼
   ┌─────────────────┐         ┌─────────────────┐   ┌─────────────────┐
   │   HR data WB    │         │  Inventory WB   │   │ Accounting WB   │
   └─────────────────┘         └─────────────────┘   └─────────────────┘

   ┌───────────────────────────── shared across all modules ─────────────────────────┐
   │  AUTH workbook   users · sessions · roleGrants                                    │
   │  MASTER workbook companies · employees(ref) · cost-centers · lookup tables        │
   └──────────────────────────────────────────────────────────────────────────────────┘
```

Each module web app loads its own React UI (`doGet → index.html`) and calls its own
`api.gs` over `google.script.run`. Every `api.gs` delegates auth + cross-cutting concerns
to `Core.*` (the Library), and reads/writes its own data spreadsheet via the Core Sheets
registry.

---

## 2. The Core Library — public surface

Core is a published Apps Script project. Modules add it with a stable identifier
(e.g. `Core`) and call `Core.<Namespace>.<fn>(…)`. Nothing in Core has a `doGet` — it is
pure logic.

```
Core
 ├─ Auth        login, logout, me, userFromToken, requireUser, requireRole,
 │              changeOwnPassword, registerUser, setUserActive, setUserRole, deleteUser
 ├─ Rbac        hasModuleRole(user, module, minRole), grants registry
 ├─ Sheets      open(handle) → Spreadsheet,  sheet(handle, tab, headers) → Sheet
 │              (handle ∈ AUTH | MASTER | module-registered IDs)
 ├─ Cache       getOrSet, get, set, remove   (namespaced per module — see §6)
 ├─ Lock        withLock(fn, timeoutMs?)
 ├─ Repo        base helpers: findAllRows, findRowIndexById, upsertRow, deleteRow
 │              (operate on a (handle, tab, headers) descriptor — modules build entities on top)
 ├─ Mapper      row↔object helpers: str, num, bool, isoDate
 ├─ Validate    required, string, number, array, enumOf, …
 ├─ Uuid        generate
 ├─ DateTime    nowIso
 ├─ Crypto      hashPassword, verifyPassword, randomToken
 └─ Errors      AppError.validation/notFound/conflict/unauthorized
```

**What moves into Core** (from today's `src/server`): everything in `lib/*`, the auth
service + user repository, and *generalised* repository/mapper base helpers.
**What stays per-module:** entity types, entity repositories/mappers (thin, built on
`Core.Repo`), business services, validators specific to that domain, `api.gs`, the UI.

### Why a Library (not HTTP)
In-process call, no network hop, no second cold-start — preserves the latency work from
this session. Cost: each module must bump the Core library version when Core changes
(handled in §7 release flow).

---

## 3. Identity, sessions, RBAC across modules

One Auth workbook, shared. The session token a user holds is **system-wide** — log in
once conceptually, though each module web app is a separate URL (see §5 SSO note).

### Roles become two-dimensional
Today: a single global role (`inventory_staff | supervisor | admin`).
Unified: a user has **per-module role grants**, plus an optional system role.

```
Auth workbook
  Users        : id | username | passwordHash | systemRole | active | createdAt | updatedAt
  Sessions     : token | userId | createdAt | expiresAt | lastUsedAt
  RoleGrants   : userId | module | role           ← e.g. (u1, 'hr', 'manager')
```

`systemRole = admin` ⇒ superuser across modules. Otherwise access is governed by
`RoleGrants`. Each module declares its own role ladder in its own config; Core only
stores/looks up the (userId, module, role) triples and compares ranks the module supplies.

```js
// in a module's api.gs
function listEmployees(token) {
  var user = Core.Auth.requireUser(token);
  Core.Rbac.requireModuleRole(user, 'hr', HrConfig.ROLES.VIEWER);   // module-defined ladder
  return EmployeeService.listEmployees();
}
```

Core stays domain-agnostic: it knows *that* roles exist and how to compare ranks given a
ladder, not *which* roles HR or Accounting have.

---

## 4. Spreadsheet access — the registry pattern

No spreadsheet ID is hardcoded. Each module's **Script Properties** hold the IDs it needs;
Core exposes a uniform opener so module code never touches `SpreadsheetApp.openById`
directly.

```
Script Properties (per module project)
  AUTH_SPREADSHEET_ID     = …    (same value in every module)
  MASTER_SPREADSHEET_ID   = …    (same value in every module)
  DATA_SPREADSHEET_ID     = …    (this module's own data WB)
```

```js
// Core.Sheets
var HANDLES = { AUTH: 'AUTH_SPREADSHEET_ID',
                MASTER: 'MASTER_SPREADSHEET_ID',
                DATA: 'DATA_SPREADSHEET_ID' };

var open = (handle) => {
  var prop = HANDLES[handle] || handle;            // allow raw prop keys too
  var id = PropertiesService.getScriptProperties().getProperty(prop);
  if (!id) throw Core.Errors.AppError.validation('Missing spreadsheet id: ' + prop);
  return SpreadsheetApp.openById(id);
};

var sheet = (handle, tab, headers) => { /* open → getSheetByName → create+freeze if absent */ };
```

A module repository now reads/writes like:

```js
var EmployeeRepository = (function () {
  var TAB = 'Employees';
  var HEADERS = ['id','name','department','hiredAt','active','updatedAt'];
  var findAll = () => Core.Cache.getOrSet('hr:employees_all',
    () => Core.Repo.findAllRows(Core.Sheets.sheet('DATA', TAB, HEADERS), HEADERS).map(EmployeeMapper.fromRow),
    300);
  // insert/update/remove via Core.Repo.upsertRow / deleteRow inside Core.Lock.withLock
  return { findAll, /* … */ };
})();
```

---

## 5. Module web apps

Each module is its own GAS project (one repo subfolder each, see §8) with:

- `webapp.gs` — `doGet → HtmlService` (its own React `index.html`)
- `api.gs` — thin top-level RPC functions: `Core.Auth.requireRole → Validate → delegate → return`
- `services/`, `repositories/`, `mappers/`, `config.gs` — module-specific, building on `Core.*`
- `appsscript.json` — adds the Core library dependency
- React client — same Vite single-file pattern as today; per-module `ServerFunctions` contract

```jsonc
// module appsscript.json
{
  "dependencies": {
    "libraries": [
      { "userSymbol": "Core", "libraryId": "<CORE_SCRIPT_ID>", "version": "7", "developmentMode": false }
    ]
  },
  "webapp": { "executeAs": "USER_DEPLOYING", "access": "ANYONE" },
  "runtimeVersion": "V8", "exceptionLogging": "STACKDRIVER"
}
```

### SSO across separate module URLs (the one rough edge)
Because each module is a separate web-app origin, `localStorage` tokens are **not shared**
between them. Options, simplest → strongest:
- **A. Re-login per module** (acceptable MVP; sessions are central so credentials are the same).
- **B. Token hand-off**: a small "launcher" page links to each module with the token in the
  URL fragment (`/exec#token=…`), module stores it locally. Central session still validated server-side.
- **C. Central launcher app** that issues short-lived per-module tokens.

Recommend **A for v1**, design toward **B**. (Server-side identity is already unified; this
is purely client token transport.)

---

## 6. Cross-cutting concerns under multi-tenancy

| Concern | Rule in unified system |
|---|---|
| **Cache keys** | Namespace by module: `Core.Cache` auto-prefixes with a module id set once at module init (`Core.init({ module: 'hr' })`). Prevents `inventory_items_all` colliding across modules sharing `CacheService` scope. |
| **Locks** | `Core.Lock.withLock` uses `LockService.getScriptLock()` — **per script project**, so each module already has its own lock domain. Cross-module writes to a *shared* workbook (Auth/Master) need `getDocumentLock` on that spreadsheet instead — Core exposes `withLock(fn, { scope: 'document', handle })`. |
| **Auth writes contention** | Auth workbook is shared → concurrent module logins compete. Keep the session-touch throttle (already built) and the short-TTL session cache; both carry over into Core. |
| **Execution budget** | Each module has its own ~6-min cap (separate projects) — better isolation than one shell app. |
| **Errors / logging** | `Core.Errors.AppError` shared; each module's Stackdriver is separate (its own project). |

---

## 7. Versioning & release flow

```
Core change → bump Core library version → publish new Core deployment (vN)
            → in each module appsscript.json, set library version = vN
            → redeploy modules that need the change (deploy:version)
```

- Use `developmentMode: false` + pinned `version` in production (reproducible).
- `developmentMode: true` only in a dev module while iterating on Core (always-latest, no bump).
- A module not yet bumped keeps running the old Core version — **safe staged rollout**.

---

## 8. Repository / build layout (monorepo, multi-target)

One git repo, one `package.json`, multiple GAS targets. Each target gets its own
`.clasp.json` (different `scriptId`, different `rootDir`).

```
/core/                      → published as Core Library
  src/server/{lib,auth,repo-base,…}.js
  .clasp.core.json          (scriptId = core)
/modules/
  /inventory/
    src/client/…  src/server/{api,services,repositories,mappers,config,webapp}.js
    .clasp.inventory.json
  /hr/            (same shape)
  /accounting/    (same shape)
/shared/                    → TS contract bits reused by clients (types base, server bridge)
scripts/
  build.mjs        --target=<core|hr|inventory|accounting>
  deploy.mjs       --target=…  (build → copy:server → clasp push → versioned deploy)
  pin-core.mjs     bump all modules to a Core version
```

`copy-server.mjs` parameterises by target; the Core target publishes a library version
instead of a web-app deployment.

---

## 9. Migration path (incremental, no big-bang)

1. **Extract Core** from today's `src/server`: move `lib/*`, `authService`, `userRepository`,
   and generalise repo/mapper helpers into `/core`. Publish as a Library (v1).
2. **Reshape Inventory** into the first module: its `api.gs`/services call `Core.*`; add the
   library dep; move Auth out of its codebase. Behaviour identical to today.
   *(This validates the whole pattern with a known-good app before adding HR/Accounting.)*
3. **Add RoleGrants** to Auth workbook; migrate Inventory's single role → `(userId,'inventory',role)`.
4. **Sheets registry**: replace `getActiveSpreadsheet()` with `Core.Sheets.open('DATA')`;
   set `DATA_SPREADSHEET_ID` in Inventory's Script Properties.
5. **Scaffold HR** as module #2 from the now-proven template (`/modules/hr`).
6. **Scaffold Accounting** as module #3.
7. **SSO** (option B token hand-off) once ≥2 modules are live.

Each step ships independently; Inventory stays usable throughout.

---

## 10. What carries over from this session

The latency work is **not** thrown away — it relocates into Core and is inherited by every
module:
- Session-touch throttle, short-TTL session cache → `Core.Auth`.
- `Cache.getOrSet` + size guard, single-batched-read repo pattern → `Core.Cache` / `Core.Repo`.
- `Lock.withLock` → `Core.Lock`.
- Client persisted-query cache + global activity indicator → per-module React (copied via `/shared`).

---

## Decisions

| # | Decision | Chosen | Rejected alternatives |
|---|---|---|---|
| 1 | Core sharing | **Apps Script Library** (in-process) | HTTP service (network+cold-start each call); build-time copy (redeploy-all on core change) |
| 2 | UI topology | **One web-app per module** | Single shell app (couples deploys, shared 6-min budget) |
| 3 | Data layout | **Shared Auth + Master, per-module data** | One mega-spreadsheet (contention, 10M-cell limit); fully separate auth (no unified identity) |

## Open questions for next pass

- Module role ladders: define HR / Accounting ladders, or keep a shared 3-tier ladder with per-module grants?
- Master workbook contents: which reference data is truly shared (employees? cost centers? company list?).
- SSO timing: ship v1 with per-module login, or build token hand-off before HR launches?
- Audit trail: does the unified system need a central activity/audit log in Core (who-did-what across modules)?
```
