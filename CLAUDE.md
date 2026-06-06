# CLAUDE.md — GAS Inventory System

Complete reference for Claude Code. No external docs needed — everything is here.

@CLAUDE.local.md

---

## System Overview

A Google Apps Script web app. React frontend + Google Sheets backend. GAS dictates the architecture — every constraint below is a hard reality, not a preference.

```
┌─────────────────────────────────────────────────────┐
│ Browser (inside GAS iframe)                         │
│   React: PublicApp / PrivateApp / MobileApp         │
│     └─ feature hooks → server.ts (RPC bridge)       │
└───────────────────────┬─────────────────────────────┘
              google.script.run  (ONLY channel)
┌───────────────────────▼─────────────────────────────┐
│ Apps Script V8 — stateless, ~6 min cap              │
│   webapp.js (doGet) → dist/index.html               │
│   api.js → services → repositories → mappers        │
└───────────────────────┬─────────────────────────────┘
                   SpreadsheetApp
┌───────────────────────▼─────────────────────────────┐
│ Google Sheets                                       │
│   Main: SkuCategories · InventoryItems · Items      │
│   Auth: Users · Sessions  (separate spreadsheet)    │
└─────────────────────────────────────────────────────┘
```

### Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite 5 (SWC) + Tailwind + shadcn/ui |
| Bundling | `vite-plugin-singlefile` — one self-contained inlined HTML file |
| Transport | `gas-client` over `google.script.run` |
| Backend | Google Apps Script V8, plain JS (no ES modules) |
| Database | Google Sheets — one tab per entity |
| Routing | `react-router-dom` HashRouter (`/#/path`) |
| Contract | `src/shared/types.ts` — single source of truth for both sides |

### GAS Hard Constraints

| Constraint | Consequence |
|---|---|
| Serves **one self-contained HTML file** | Vite builds to single inlined `dist/index.html` |
| Only channel is **`google.script.run`** | No fetch, no REST, no websockets |
| **No ES modules** in pushed JS | Use IIFEs: `var Foo = (function() { … })();` |
| **Top-level named functions only** in api.js | Arrow functions aren't exposed by GAS |
| **Stateless per call**, ~6 min cap | No long-running ops, no in-memory state across calls |
| **No URL control** in iframe | HashRouter only (`/#/path`) |
| **`CacheService` values are strings** | Always `JSON.stringify`/`JSON.parse` |
| **`Utilities.getUuid()`** is the only UUID source | Never trust client-generated IDs |

---

## Hard Rules — Never Violate

### Contract & Types
- **Edit `src/shared/types.ts` first** — every new entity, RPC function, or shape change starts here
- **`type` over `interface`** everywhere — no exceptions
- **No `any`** — use `unknown` + narrowing, or define the type
- **All `ServerFunctions` args/returns must be JSON-serializable** — no `Date`, class instances, or functions

### Backend Layer Order
```
api.js → service → repository → mapper
                 ↗ lib (reachable from any layer)
```
- `api.js` — thin shim: **auth check → validate → delegate → return**. Zero logic.
- `services/` — all business rules, computed fields, cross-entity checks
- `repositories/` — Sheets I/O only; one file per sheet tab; no business logic
- `mappers/` — pure functions `row[] ↔ entity`; no I/O; no service calls
- Never skip or reverse the layer order. Repositories never call services. Mappers never call repositories.

### Sheets I/O
- **Batch all reads** — one `getRange().getValues()`, filter/map in JS; never cell-by-cell
- **Every write in `Lock.withLock(fn)`** — no exceptions
- **`Cache.remove(key)` after every write** — invalidate immediately after mutation
- **`Cache.getOrSet(key, fn, ttl)`** for hot reads — TTLs: categories 300s, inventoryItems 120s, items 300s

### Frontend
- **`src/client/lib/server.ts` is the only file** that touches `google.script.run`
- **All `server.*` calls live in feature hooks** — never in components
- **Route paths are constants** in `src/client/routes/paths.ts` — never hardcode strings
- **Role gates at route level** via `<RequireRole>` — never inside feature components
- **Features do not import from other features** — `index.ts` is the only public surface per feature
- **Atomic levels**: atoms (no logic, no context) → molecules (local state only) → organisms (may read context) → templates (layout only, no data)

### Mock Parity
- **`api.js` changes → `src/client/lib/server.ts` changes in the same commit**
- Every function needs a real call in `buildServer()` AND a mock branch in `createMock()`
- Mock must mirror real service: same output shape, same computed fields, same validation

### Deploys
- **Always `npm run deploy:version`** — never `npm run deploy` (HEAD-only)
- **`npm run typecheck:all` must pass** before any deploy — checks both client and server contract

---

## Business Rules (enforced in services only)

| Rule | Enforced in |
|---|---|
| `qtyTotal = qtyGround + qtyUpstair + (qtyBox × uom)` — recomputed every write | `inventoryItemService` |
| `kyteMatch = qtyKyte === 0 \|\| qtyTotal === qtyKyte` — recomputed every write | `inventoryItemService` |
| `costTotal = unitCost × qtyTotal` — recomputed every write | `inventoryItemService` |
| `unitCost = costPerPieceNew > 0 ? costPerPieceNew : costPerPieceOld` | `inventoryItemService` |
| Cost/price fields (cols G–M) **read-only on update** — preserved from DB | `inventoryItemService.updateInventoryItem` |
| `bulkUpdateStock`/`saveAndVerifyStock` touch **only** the 3 qty columns | `inventoryItemService` |
| Category delete blocked if it has inventory items | `categoryService.deleteCategory` |
| Category `code` unique — enforced on add and update | `categoryService` |
| Login throttled: 5 failures / 15 min → 15 min lockout | `authService` |
| Password: min 10 chars, 3 of 4 classes (lower/upper/digit/symbol) | `authService` |
| Cannot deactivate / change role / delete self | `authService` |

---

## Data Model

### Conventions
- One sheet tab per entity; `HEADERS` array in the repository is the column contract
- Header row = schema; row 1 is frozen; column order is positional
- UUID primary keys — server-side only via `Uuid.generate()`
- ISO 8601 strings for timestamps — never rely on Sheets date types
- `findById` does a linear O(n) scan — keep tabs small, cache hot reads
- Hard delete — no soft delete in current implementation
- Computed fields (`qtyTotal`, `kyteMatch`, `costTotal`) stored for read perf but always recomputed on write

### Schemas

**SkuCategories**
| Col | Field | Type | Notes |
|---|---|---|---|
| A | `id` | uuid | PK |
| B | `code` | string | Short unique code e.g. `r1f` |
| C | `name` | string | Display name |
| D | `packConstraint` | string | Optional pack rule |
| E | `sortOrder` | number | Display order |
| F | `updatedAt` | ISO string | |

**InventoryItems**
| Col | Field | Type | Notes |
|---|---|---|---|
| A | `id` | uuid | PK |
| B | `categoryId` | uuid | FK → SkuCategories.id |
| C | `store` | enum | `EASY` \| `GRUTON` |
| D | `sku` | string | Display name, emoji-prefixed |
| E | `emoji` | string | Extracted emoji |
| F | `uom` | number | Units per box |
| G | `costPerBoxNew` | decimal | Current cost/box — **read-only on update** |
| H | `costPerPieceNew` | decimal | Current cost/piece — **read-only on update** |
| I | `costPerPieceOld` | decimal | Previous cost/piece — **read-only on update** |
| J | `sellingPriceWholesale` | decimal | **read-only on update** |
| K | `sellingPriceDealer` | decimal | **read-only on update** |
| L | `sellingPricePiece` | decimal | **read-only on update** |
| M | `srp` | decimal | **read-only on update** |
| N | `qtyGround` | number | Stock at ground |
| O | `expiryGround` | ISO date | Optional, `YYYY-MM-DD` or `''` |
| P | `qtyUpstair` | number | Stock upstairs |
| Q | `expiryUpstair` | ISO date | Optional, `YYYY-MM-DD` or `''` |
| R | `qtyBox` | number | Stock in boxes |
| S | `expiryBox` | ISO date | Optional, `YYYY-MM-DD` or `''` |
| T | `qtyTotal` | number | **Computed** |
| U | `qtyKyte` | number | Kyte POS qty |
| V | `kyteMatch` | boolean | **Computed** |
| W | `costTotal` | decimal | **Computed** |
| X | `updatedAt` | ISO string | |

**Items** (legacy): `id | name | quantity | updatedAt`

**Users** (auth workbook): `id | username | passwordHash | role | active | createdAt | updatedAt`

**Sessions** (auth workbook): `token | userId | createdAt | expiresAt | lastUsedAt`

### Auth workbook
`AUTH_SPREADSHEET_ID` in Script Properties. Auto-created as `Inventory Auth (do not share)` on first login if missing.

### Cache TTLs
| Entity | TTL | Key |
|---|---|---|
| SkuCategories | 300s | `'categories_all'` |
| InventoryItems | 120s | `'inventory_items_all'` |
| Items | 300s | `'items_all'` |

---

## API Surface (23 RPC Functions)

Source of truth: `src/shared/types.ts` `ServerFunctions`. Token injected automatically by `server.ts` — never pass from a component.

Roles: `inventory_staff` (1) · `supervisor` (2) · `admin` (3). `requireRole` checks rank ≥ min.

### Auth
| Function | Min Role | Returns | Notes |
|---|---|---|---|
| `login(username, password)` | — | `AuthSession` | No token. Throttled 5 fails/15 min → 15 min lockout |
| `logout` | any | `{ ok: true }` | Deletes session row |
| `me` | any | `User \| null` | Returns current user or null if expired |
| `changeOwnPassword` | any | `{ ok: true }` | 10+ chars, 3 of 4 char classes |

### Users (admin only)
| Function | Returns | Notes |
|---|---|---|
| `listUsers` | `User[]` | Never includes passwordHash |
| `registerUser(username, password, role)` | `User` | Password policy enforced |
| `setUserActive(userId, active)` | `User` | Cannot deactivate self |
| `setUserRole(userId, role)` | `User` | Cannot change own role |
| `deleteUserAccount(userId)` | `{ id }` | Hard delete. Cannot delete self |

### Categories
| Function | Min Role | Returns | Notes |
|---|---|---|---|
| `getCategories` | any | `SkuCategory[]` | Sorted by sortOrder. Cached 5 min |
| `addCategory(cat)` | supervisor | `SkuCategory` | code must be unique |
| `updateCategory(cat)` | supervisor | `SkuCategory` | code uniqueness enforced |
| `deleteCategory(id)` | supervisor | `{ id }` | Blocked if has inventory items |

### Inventory
| Function | Min Role | Returns | Notes |
|---|---|---|---|
| `getInventoryItems(categoryId?)` | any | `InventoryItem[]` | Cached 2 min |
| `addInventoryItem(item)` | supervisor | `InventoryItem` | Computed fields set server-side |
| `updateInventoryItem(item)` | supervisor | `InventoryItem` | Cost/price cols G–M preserved from DB |
| `deleteInventoryItem(id)` | supervisor | `{ id }` | Hard delete |
| `bulkUpdateStock(updates)` | staff | `InventoryItem[]` | Only qty cols, recomputes derived fields |
| `saveAndVerifyStock(update)` | staff | `InventoryItem` | Saves + re-reads bypassing cache |

### Summary
| Function | Min Role | Returns |
|---|---|---|
| `getInventorySummary` | any | `{ totalCost, totalQty, categoryCount, skuCount, mismatchCount, zeroStockCount }` |
| `getCategoryTotals` | any | `CategoryTotal[]` — per-category `{ totalCost, totalQty, skuCount }` |

### Data / Legacy
| Function | Min Role | Notes |
|---|---|---|
| `reseedInventory` | admin | Re-runs Product Info sheet migration |
| `getItems` / `addItem` / `updateItem` / `deleteItem` | any | Legacy entity |

### Type shapes
```ts
type AuthSession   = { token: string; user: User; expiresAt: string }
type User          = { id: string; username: string; role: Role; active: boolean }
type Role          = 'inventory_staff' | 'supervisor' | 'admin'
type SkuCategory   = { id: string; code: string; name: string; packConstraint: string; sortOrder: number; updatedAt: string }
type InventoryItem = { id: string; categoryId: string; store: 'EASY'|'GRUTON'; sku: string; emoji: string; uom: number;
  costPerBoxNew: number; costPerPieceNew: number; costPerPieceOld: number;
  sellingPriceWholesale: number; sellingPriceDealer: number; sellingPricePiece: number; srp: number;
  qtyGround: number; expiryGround: string; qtyUpstair: number; expiryUpstair: string; qtyBox: number; expiryBox: string;
  qtyTotal: number; qtyKyte: number; kyteMatch: boolean; costTotal: number; updatedAt: string }
type StockUpdate      = { id: string; qtyGround: number; qtyUpstair: number; qtyBox: number }
type InventorySummary = { totalCost: number; totalQty: number; categoryCount: number; skuCount: number; mismatchCount: number; zeroStockCount: number }
type CategoryTotal    = { categoryId: string; categoryCode: string; categoryName: string; totalCost: number; totalQty: number; skuCount: number }
type Item             = { id: string; name: string; quantity: number; updatedAt: string }
```

---

## Code Patterns

### api.js function
```js
function addInventoryItem(token, item) {        // named function declaration, not arrow
  AuthService.requireRole(token, _getRole().SUPERVISOR);
  validate.inventoryItem(item);
  return InventoryItemService.addInventoryItem(item);  // delegate, never catch
}
```

### Repository
```js
var CategoryRepository = (function () {
  var SHEET_NAME = Config.SHEETS.categories;
  var HEADERS    = ['id', 'code', 'name', 'packConstraint', 'sortOrder', 'updatedAt'];
  var CACHE_KEY  = Config.CACHE_KEYS.categories;

  var getSheet = () => {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) { sheet = ss.insertSheet(SHEET_NAME); sheet.getRange(1,1,1,HEADERS.length).setValues([HEADERS]); sheet.setFrozenRows(1); }
    return sheet;
  };

  var findAll = () => Cache.getOrSet(CACHE_KEY, () => {
    var sheet = getSheet(); var last = sheet.getLastRow();
    if (last < 2) return [];
    return sheet.getRange(2, 1, last - 1, HEADERS.length).getValues()
      .filter(r => r[0]).map(CategoryMapper.fromRow).sort((a,b) => a.sortOrder - b.sortOrder);
  }, Config.CACHE_TTL.categories);

  var findById = (id) => findAll().find(c => c.id === String(id)) || null;

  var insert = (cat) => Lock.withLock(() => {
    getSheet().appendRow(CategoryMapper.toRow(cat));
    Cache.remove(CACHE_KEY);
    return cat;
  });

  var update = (cat) => Lock.withLock(() => {
    var sheet = getSheet();
    var rows  = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
    var idx   = rows.findIndex(r => r[0] === cat.id);
    if (idx === -1) throw AppError.notFound('Category', cat.id);
    sheet.getRange(idx + 2, 1, 1, HEADERS.length).setValues([CategoryMapper.toRow(cat)]);
    Cache.remove(CACHE_KEY);
    return cat;
  });

  var remove = (id) => Lock.withLock(() => {
    var sheet = getSheet();
    var rows  = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var idx   = rows.findIndex(r => r[0] === id);
    if (idx === -1) throw AppError.notFound('Category', id);
    sheet.deleteRow(idx + 2);
    Cache.remove(CACHE_KEY);
  });

  return { findAll, findById, insert, update, remove };
})();
```

### Mapper
```js
var CategoryMapper = (function () {
  var fromRow = (row) => ({
    id: String(row[0]), code: String(row[1]), name: String(row[2]),
    packConstraint: String(row[3] || ''), sortOrder: Number(row[4]) || 0, updatedAt: String(row[5]),
  });
  var toRow = (cat) => [cat.id, cat.code, cat.name, cat.packConstraint, cat.sortOrder, cat.updatedAt];
  return { fromRow, toRow };
})();
```

### Service
```js
var CategoryService = (function () {
  var addCategory = (input) => {
    var code = String(input.code).trim();
    if (CategoryRepository.findByCode(code)) throw AppError.conflict('Category code exists: ' + code);
    var cat = { id: Uuid.generate(), code, name: String(input.name).trim(),
                packConstraint: String(input.packConstraint || '').trim(),
                sortOrder: Number(input.sortOrder) || 0, updatedAt: DateTime.nowIso() };
    return CategoryRepository.insert(cat);
  };
  var updateCategory = (input) => {
    var existing = CategoryRepository.findById(input.id);
    if (!existing) throw AppError.notFound('Category', input.id);
    var clash = CategoryRepository.findByCode(String(input.code).trim());
    if (clash && clash.id !== existing.id) throw AppError.conflict('Category code exists: ' + input.code);
    return CategoryRepository.update({ ...existing, ...input, updatedAt: DateTime.nowIso() });
  };
  return { getCategories: () => CategoryRepository.findAll(), addCategory, updateCategory, deleteCategory };
})();
```

### Feature hook
```ts
export function useCategories() {
  const [items, setItems] = useState<SkuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await server.getCategories()); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (input: Omit<SkuCategory, 'id'|'updatedAt'>) => {
    await server.addCategory(input); await load();
  }, [load]);

  return { items, loading, error, reload: load, add };
}
```

### RPC bridge entry (server.ts)
```ts
// In buildServer():
addCategory: (cat) => call('addCategory', cat),

// In createMock():
addCategory: async (cat) => {
  const entity: SkuCategory = { ...cat, id: crypto.randomUUID(), updatedAt: new Date().toISOString() };
  mockCategories.push(entity);
  return entity;
},
```

### Validator
```js
// In validate.js, add to return object:
var category = (input) => {
  required(input, 'category');
  string(input.code, 'code');
  string(input.name, 'name');
};
```

---

## File Map

| File | Role |
|---|---|
| `src/shared/types.ts` | Master contract — entity types + `ServerFunctions`. **Edit first.** |
| `src/client/lib/server.ts` | RPC bridge — real `gas-client` vs mock. Only file touching `google.script.run`. |
| `src/client/lib/serverMock.ts` | Mock implementations — mirrors every real server function. |
| `src/server/api.js` | 23 top-level named functions — thin shims only. |
| `src/server/config.js` | Sheet names, cache TTLs, roles, stores, auth policy. |
| `src/server/lib/validate.js` | All input validators. |
| `src/server/lib/errors.js` | `AppError.validation/notFound/conflict/auth(msg)` |
| `src/server/lib/lock.js` | `Lock.withLock(fn, timeoutMs?)` |
| `src/server/lib/cache.js` | `Cache.getOrSet(key, fn, ttl)`, `Cache.remove(key)` |
| `src/server/lib/uuid.js` | `Uuid.generate()` |
| `src/server/lib/datetime.js` | `DateTime.nowIso()` |
| `src/server/lib/crypto.js` | `Crypto.hashPassword`, `Crypto.verifyPassword`, `Crypto.randomToken` |
| `src/client/routes/paths.ts` | All route path constants — always use these. |
| `src/client/routes/guards.tsx` | `RequireAuth`, `RequireGuest`, `RequireRole` |

---

## Routes

| Path | Guard | Min Role | Feature |
|---|---|---|---|
| `/login` | `RequireGuest` | — | Login — `PublicApp` |
| `/dashboard` | `RequireAuth` | any | KPI summary |
| `/analytics` | `RequireAuth` | any | Category charts |
| `/inventory` | `RequireAuth` | any | SKU list + stock update |
| `/categories` | `RequireRole` | supervisor | Category CRUD |
| `/users` | `RequireRole` | admin | User management |
| `/m/*` | `RequireAuth` | any | Mobile versions of above |

To add a route: path constant in `paths.ts` → `<Route>` in `PrivateApp.tsx`/`MobileApp.tsx` → `<RequireRole>` if gated.

---

## Dev Commands

```bash
npm run dev              # Vite + HMR at localhost:5173, in-memory mock backend
npm run typecheck        # check client + shared (tsconfig.client.json)
npm run typecheck:server # check server contract (tsconfig.server.json)
npm run typecheck:all    # check both — run this before every deploy
npm run build            # production bundle → dist/index.html
npm run deploy           # build + push to @HEAD (iterative dev only)
npm run deploy:version   # build + push + new versioned deployment (always use this for releases)
npm run open             # open Apps Script editor
npm run logs             # tail Stackdriver logs
```

Local dev has no GAS host — header badge shows `local mock` vs `Sheets backend`.

Two TS projects typechecked together:
- `tsconfig.client.json` — `src/client/` + `src/shared/`
- `tsconfig.server.json` — `src/server/contract.ts` asserts `api.js` implements `ServerFunctions` (never pushed)

---

## Adding a Feature — 6 Steps

> Slash command: `/project:add-feature` for a guided walkthrough.

1. **`src/shared/types.ts`** — entity `type` + `New<Entity>` input type + `ServerFunctions` entries. Run `typecheck`.
2. **`src/server/repositories/<name>Repository.js`** — `SHEET_NAME`, `HEADERS`, `findAll/findById/insert/update/remove`. Add to `config.js` SHEETS/CACHE_TTL/CACHE_KEYS.
3. **`src/server/mappers/<name>Mapper.js`** — `fromRow`/`toRow`. Column order must match `HEADERS`. Handle null cells.
4. **`src/server/services/<name>Service.js`** — all business rules, computed fields, `AppError` on violations.
5. **`src/server/api.js`** — named function declaration per operation: auth → validate → delegate → return.
6. **`src/client/lib/server.ts`** — real call in `buildServer()` + mock in `createMock()`. **Same commit.**

Then: feature hook → component → route if new page.

### Pre-deploy Checklist
- [ ] `npm run typecheck:all` passes (client + server contract)
- [ ] Mock mirrors real service (shape, computed fields, validation)
- [ ] New sheet tab in `config.js` `SHEETS`
- [ ] Role gate in `api.js`
- [ ] Path constant + route added if new page
- [ ] `npm run deploy:version`

---

## Naming

| Thing | Convention |
|---|---|
| TypeScript types | `type`, PascalCase |
| React hooks | `useXxx`, file name matches |
| Feature public surface | `index.ts` only — never import deeper |
| Server services/libs | IIFE, PascalCase var name |
| Route constants | `ROUTES.SCREAMING_SNAKE` in `paths.ts` |
| Validators | `validate.camelCase` |

---

## Troubleshooting

**`google is not defined` in dev** — expected. No GAS host during `npm run dev`. Mock is active.

**New server function not callable** — must be a top-level named function in a pushed `.js` file. Re-deploy. Add real call + mock in `server.ts`.

**RPC returns `undefined` or serialization error** — args/returns must be JSON-serializable. No `Date`, no class instances.

**`Item not found` on update/delete** — `findById` does linear scan; ID must match exactly.

**`dist/index.html` not found during deploy** — run `npm run build` first.

**Blank page / 404 assets in GAS** — `dist/index.html` must be self-contained. Check `vite-plugin-singlefile` is active.

**Push succeeds but live app unchanged** — deployment pinned to fixed version, not `@HEAD`. Check Deploy → Manage deployments in Apps Script editor.

**Lost/overwritten writes** — read-then-write race. Wrap all mutations in `Lock.withLock()`.

**Slow reads** — per-cell or repeated `getRange` calls. Batch with one `getValues()`. Cache with `Cache.getOrSet()`.

**Authorization prompt loops** — required scope changed. Open editor (`npm run open`), run any function to re-trigger consent, redeploy.

**`.clasp.json not found`** — run `npm run login` then `npm run setup`.

---

## Permissions

All tools are pre-approved on this project — never ask for permission before reading, writing, editing, or running commands.

---

## Slash Commands

| Command | Use when |
|---|---|
| `/add-feature [FeatureName]` | Adding a full new entity end-to-end — injects live contract state |
| `/new-rpc [functionName]` | Adding one RPC to an existing service — injects live api.js + types.ts |
| `/deploy-check` | Before any production deploy — runs typecheck live, audits all gates |
| `/verify-contract` | When api.js, types.ts, or server.ts may have drifted — reads live state |

---

## Common Mistakes

- `server.*` called from a component — belongs in a hook
- `interface` instead of `type`
- `export`/`import` in server `.js` — GAS V8 doesn't support it
- Arrow function as top-level api.js function — GAS won't expose it
- Storing `qtyTotal`/`kyteMatch`/`costTotal` directly — always recompute on write
- Hardcoding route strings — use `ROUTES.*`
- Missing `Lock.withLock()` on a Sheets write
- `npm run deploy` instead of `deploy:version`
- Changing `api.js` without updating both real call and mock in `server.ts`
- Overwriting cost/price fields (cols G–M) on update — preserve from DB

---

## Non-Goals

Not in scope — don't implement unless explicitly asked:
- Reconciliation workflows, variance approvals, POS comparison
- Receiving, transfers, damage/expiry workflows
- Separate REST/Node backend
- Relational/document DB
- SSR, WebSockets, server-side sessions
- Multi-bundle / micro-frontends
