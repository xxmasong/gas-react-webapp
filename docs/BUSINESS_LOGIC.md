# Business logic & modular logic — exact specification

The precise, reproducible behavior of every layer and every operation. Paired with
[PROJECT_LAYOUT.md](PROJECT_LAYOUT.md) (the file tree + configs), this is enough to
recreate the app's behavior exactly. For the layer *philosophy* see
[BACKEND_GUIDELINES.md](BACKEND_GUIDELINES.md); for the recipe to add features see
[CONTRIBUTING.md](CONTRIBUTING.md).

> Conventions in this doc: server modules are **IIFE globals** (`var X = (function(){…})();`);
> `api.js` functions are **top-level declarations**. Reproduce signatures and names
> exactly — the client calls server functions by name via `gas-client`.

---

## 1. The contract

`src/shared/types.ts` — the single seam both sides compile against:

```ts
export interface Item {
  id: string;          // uuid, assigned server-side
  name: string;
  quantity: number;
  updatedAt: string;   // ISO timestamp, set on every write
}

export type NewItem = Pick<Item, 'name' | 'quantity'>;

export interface ServerFunctions {
  getItems(): Item[];
  addItem(item: NewItem): Item;
  updateItem(item: Item): Item;
  deleteItem(id: string): { id: string };
}
```

Every callable crosses a process boundary, so **arguments and return values must be
JSON-serializable** (plain objects/strings/numbers — no `Date`, class instances, or
functions).

---

## 2. Module responsibilities (the modular logic)

```
client: InventoryView ─► useInventory ─► server (lib/server.ts) ──RPC──►
server: api.js ─► InventoryService ─► ItemRepository ─► ItemMapper
                                   └─► (any layer) ─► lib/*
```

Strict dependency direction (a layer only calls the layer below + `lib/`):

| Module | May call | Must NOT |
|---|---|---|
| `api.js` | `validate.*`, `InventoryService.*` | touch `SpreadsheetApp`; contain business rules |
| `InventoryService` | `ItemRepository.*`, `Uuid`, `DateTime`, `AppError` | touch `SpreadsheetApp`; do row math |
| `ItemRepository` | `SpreadsheetApp`, `ItemMapper`, `Lock`, `Cache`, `AppError` | contain business rules |
| `ItemMapper` | nothing (pure) | side effects, I/O |
| `lib/*` | (each other minimally) | depend on services/repos |

---

## 3. `lib/` primitives — exact contracts

### `lib/errors.js`
```js
ErrorCode = { VALIDATION:'VALIDATION_ERROR', NOT_FOUND:'NOT_FOUND',
              CONFLICT:'CONFLICT', UNAUTHORIZED:'UNAUTHORIZED', INTERNAL:'INTERNAL_ERROR' }
```
`AppError` is a factory that returns a native `Error` with extra fields
`err.code` and `err.meta`:
- `AppError.validation(msg, meta?)` → code `VALIDATION_ERROR`
- `AppError.notFound(entity, id)` → message **exactly** `"<entity> not found: <id>"`,
  code `NOT_FOUND`, `meta = { entity, id }`
- `AppError.conflict(msg, meta?)`, `AppError.unauthorized(msg)`,
  `AppError.internal(msg, cause)` (`meta = { cause: String(cause) }`)
- `AppError.isAppError(err)` → `err instanceof Error && !!err.code`

### `lib/validate.js` (depends on `AppError`)
- `required(v, name)` → throws `validation('<name> is required')` if `v == null`.
- `string(v, name)` → `required` then throws `'<name> must be a non-empty string'`
  if not a string or trimmed-empty.
- `nonNegativeNumber(v, name)` → throws `'<name> must be a non-negative number'`
  if `Number(v)` is NaN or `< 0`.
- `uuid(v, name)` → throws `'<name> must be a valid UUID'` unless it matches
  `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`.

### `lib/lock.js`
`Lock.withLock(fn)`: `LockService.getScriptLock()`, `lock.waitLock(10000)` (10s),
run `fn()` in `try`, `lock.releaseLock()` in `finally`, return `fn()`'s value.

### `lib/cache.js`
Script cache wrapper, default `TTL_SECONDS = 300`:
- `get(key)` → JSON-parse or `null`.
- `set(key, value, ttl?)` → JSON-stringify, `put(key, …, ttl || 300)`.
- `remove(key)`.
- `getOrSet(key, fn, ttl?)` → return cached if non-null, else `fn()`, `set`, return.

### `lib/uuid.js` / `lib/datetime.js`
- `Uuid.generate()` → `Utilities.getUuid()`.
- `DateTime.nowIso()` → `new Date().toISOString()`; `isValidIso(v)` → string && parseable.

---

## 4. Data layer — `ItemRepository` (the only `SpreadsheetApp` user)

Constants: `SHEET_NAME = 'Items'`, `HEADERS = ['id','name','quantity','updatedAt']`,
`CACHE_KEY = 'items_all'`.

- **`getSheet()`** — get the `Items` sheet; if missing, `insertSheet`, write `HEADERS`
  to row 1, `setFrozenRows(1)`. (First access auto-creates the schema.)
- **`findAll()`** — `Cache.getOrSet('items_all', …, 300)`:
  read `getRange(2,1,lastRow-1,4).getValues()` in ONE call, drop rows with blank id,
  map each via `ItemMapper.fromRow`. Returns `[]` when `lastRow < 2`.
- **`findById(id)`** — `findAll().find(i => i.id === String(id)) || null` (uses the cache).
- **`findRowIndexById(id)`** — scans the id column directly (NOT cached) and returns the
  1-based sheet row (`i + 2`), or `-1`. Used only inside locked writes.
- **`insert(item)`** — `Lock.withLock`: `appendRow(ItemMapper.toRow(item))`,
  `Cache.remove('items_all')`, return `item`.
- **`update(item)`** — `Lock.withLock`: resolve row via `findRowIndexById`; if `-1` throw
  `AppError.notFound('Item', id)`; `setValues([toRow])` over the row; invalidate cache; return `item`.
- **`remove(id)`** — `Lock.withLock`: resolve row; if `-1` throw `notFound`; `deleteRow`;
  invalidate cache; return `{ id }`.

**Concurrency invariant:** every mutation is wrapped in `Lock.withLock`, and row
resolution for writes uses the live scan (`findRowIndexById`), never the cache — so a
write never acts on a stale row number. Reads may be up to 300s stale; writes always
bust the cache.

`ItemMapper`:
- `fromRow(row)` → `{ id:String(row[0]), name:String(row[1]), quantity:Number(row[2])||0, updatedAt:String(row[3]) }`
- `toRow(item)` → `[item.id, item.name, item.quantity, item.updatedAt]`
(Column order is the contract — it must match `HEADERS`.)

---

## 5. Service layer — `InventoryService` (business rules)

- **`getItems()`** → `ItemRepository.findAll()`.
- **`addItem(input)`** → if `input.quantity < 0` throw `AppError.validation('quantity cannot be negative')`;
  build `{ id: Uuid.generate(), name: String(input.name).trim(), quantity: Number(input.quantity), updatedAt: DateTime.nowIso() }`;
  `ItemRepository.insert(item)`.
- **`updateItem(input)`** → `existing = ItemRepository.findById(input.id)`; if falsy throw
  `AppError.notFound('Item', input.id)`; if `input.quantity < 0` throw validation; build the
  updated entity keeping `existing.id`, re-trimming `name`, coercing `quantity`, fresh
  `updatedAt`; `ItemRepository.update(updated)`.
- **`deleteItem(id)`** → `findById(id)`; if missing throw `notFound`; `ItemRepository.remove(id)`.

**Server-assigned fields (never trusted from the client):** `id` (uuid on create, preserved
on update), `updatedAt` (always `now`). `name` is always `.trim()`-ed; `quantity` always
`Number()`-coerced.

---

## 6. RPC surface — `api.js` (thin shim, top-level globals)

```js
function getItems() { return InventoryService.getItems(); }

function addItem(item) {
  validate.required(item, 'item');
  validate.string(item.name, 'name');
  validate.nonNegativeNumber(item.quantity, 'quantity');
  return InventoryService.addItem(item);
}

function updateItem(item) {
  validate.required(item, 'item');
  validate.string(item.id, 'id');
  validate.string(item.name, 'name');
  validate.nonNegativeNumber(item.quantity, 'quantity');
  return InventoryService.updateItem(item);
}

function deleteItem(id) {
  validate.string(id, 'id');
  return InventoryService.deleteItem(id);
}
```
Validation is intentionally duplicated at the boundary (`api.js`) and enforced again in
the service — the boundary rejects malformed RPC early; the service guards its own invariants.

`webapp.js`:
```js
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('GAS React Web App')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // required to render in the GAS iframe
}
function include(filename) { return HtmlService.createHtmlOutputFromFile(filename).getContent(); }
```

`contract.ts` (compile-time only, **not pushed**):
```ts
import type { ServerFunctions } from '@shared/types';
declare const _api: ServerFunctions;
export {};
```
> What it actually does: it makes `tsc -p tsconfig.server.json` load and type-check the
> shared contract alongside the server project. It does **not** import `api.js` (plain JS)
> and therefore does **not** mechanically prove `api.js` implements `ServerFunctions`.
> Keeping `api.js` in sync with the contract is a **manual discipline** (see CONTRIBUTING).
> If you want a real compile-time guarantee, that is a future enhancement, not current behavior.

---

## 7. Client bridge — `src/client/lib/server.ts`

The single boundary to `google.script.run`. (`src/client/server.ts` is only
`export { server, runningInGas } from './lib/server';`.)

- `isGasHost = typeof google !== 'undefined' && typeof google?.script !== 'undefined'`.
- In GAS: `real = new GASClient().serverFunctions` (promise-returning proxies).
- In dev: `mock = createMock()` (in-memory).
- `call(name, ...args)` normalizes both to a `Promise` so UI code is identical either way.
- Exports `server = { getItems, addItem, updateItem, deleteItem }` (each → `call(...)`)
  and `runningInGas` (drives the header badge: `Sheets backend` vs `local mock`).

### The mock (parity is part of "done")
`createMock()` mirrors server behavior in memory and **must stay behaviorally equal**
to the real server for the contract it implements:
- Seed: `[{ id:'demo-1', name:'Sample widget', quantity:3, updatedAt: <now ISO> }]`.
- `getItems` → current array.
- `addItem(item)` → `{ id: crypto.randomUUID(), ...item, updatedAt: now }`, append, return created.
- `updateItem(item)` → `{ ...item, updatedAt: now }`, replace by id, return updated.
- `deleteItem(id)` → filter out, return `{ id }`.

**Rule:** when you add/change a server function, update the contract, `api.js`, the
service/repo, the `server` wrapper, AND this mock — in the same change.

---

## 8. Feature logic — `useInventory` + `InventoryView`

`useInventory()` owns server state:
- State: `items: Item[]`, `loading: boolean` (starts `true`), `error: string | null`.
- On mount: `load()` → `server.getItems()`; on error `setError(String(e))`; always clear loading.
- `add(item)` → `server.addItem`, append result to `items`.
- `update(item)` → `server.updateItem`, replace by id.
- `remove(id)` → `server.deleteItem`, filter by id.
- Returns `{ items, loading, error, setError, add, update, remove, reload }`.

`InventoryView()` is the page; it never calls `server.*` directly:
- Local form state `name` (string), `quantity` (number, default 1).
- Submit: ignore empty/whitespace name; `add({ name: name.trim(), quantity })`; reset form;
  surface errors via `setError`.
- Per row: `+`/`−` adjust quantity with a floor of 0 (`Math.max(0, q + delta)`) then `update`;
  a delete button calls `remove`. Buttons carry `aria-label` `increase`/`decrease`.
- Rendering: show error banner if present; `Loading…` while loading; empty-state text when no
  items; otherwise the list.

---

## 9. End-to-end example — "add an item"

1. User submits the form → `InventoryView.onAdd` → `useInventory.add({name, quantity})`.
2. `server.addItem` → `call('addItem', item)` → (GAS) `google.script.run.addItem` /
   (dev) mock.
3. `api.addItem` validates (`required`/`string`/`nonNegativeNumber`) → `InventoryService.addItem`.
4. Service rejects negative quantity, assigns `id`/`updatedAt`, trims `name` → `ItemRepository.insert`.
5. Repo takes the script lock, `appendRow(toRow)`, invalidates `items_all`, returns the item.
6. The created `Item` round-trips back as JSON; the hook appends it to `items`; the list re-renders.

Mirror this flow when adding any new entity/operation: **contract → api → service → repo →
mapper → client wrapper → mock → hook → view**, keeping every layer's responsibility intact.
