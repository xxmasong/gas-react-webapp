# Backend Guidelines

Rules and conventions for the Google Apps Script + Google Sheets backend.
Read [ARCHITECTURE.md](ARCHITECTURE.md) first for system-level context; this doc
is the implementation standard for everything under `src/server/`.

---

## Table of contents

1. [Folder structure](#1-folder-structure)
2. [Layer responsibilities](#2-layer-responsibilities)
3. [RPC surface — api.js](#3-rpc-surface--apijs)
4. [Service layer — business logic](#4-service-layer--business-logic)
5. [Repository layer — data access](#5-repository-layer--data-access)
6. [Transformation layer — mappers](#6-transformation-layer--mappers)
7. [Utility functions — lib/](#7-utility-functions--lib)
8. [Validation](#8-validation)
9. [Error handling](#9-error-handling)
10. [Concurrency and locking](#10-concurrency-and-locking)
11. [Caching](#11-caching)
12. [Logging](#12-logging)
13. [TypeScript contract](#13-typescript-contract)
14. [GAS-specific rules](#14-gas-specific-rules)

---

## 1. Folder structure

```
src/server/
  webapp.js               # transport only: doGet() — no logic whatsoever
  api.js                  # RPC surface: thin shim — validate, delegate, return
  services/               # business logic — rules, orchestration, cross-entity ops
    inventoryService.js
  repositories/           # data access — one file per Sheet tab
    itemRepository.js
  mappers/                # row ↔ object transformations — pure functions only
    itemMapper.js
  lib/                    # custom utilities NOT part of GAS (pure JS, testable)
    validate.js           # argument validators
    errors.js             # AppError class + error codes
    lock.js               # LockService wrapper
    cache.js              # CacheService wrapper
    uuid.js               # ID generation wrapper
    datetime.js           # date/timestamp helpers
  contract.ts             # compile-time conformance check — NOT pushed
```

Every file in `src/server/` is pushed to GAS as-is **except** `contract.ts`.
`lib/` functions are plain JavaScript with zero GAS dependencies — they are
testable in Node without a GAS runtime.

---

## 2. Layer responsibilities

Each layer has one job. Code in the wrong layer is the most common source of
hard-to-maintain backend code.

```
┌─────────────────────────────────────────────┐
│  api.js          RPC surface                │  ← entry point from the client
│  (transport shim)                           │    validate args → call service
├─────────────────────────────────────────────┤
│  services/       Business logic             │  ← rules, workflows, decisions
│                                             │    "what should happen and why"
├─────────────────────────────────────────────┤
│  repositories/   Data access                │  ← "how to read/write the sheet"
│                                             │    no business rules here
├─────────────────────────────────────────────┤
│  mappers/        Transformation             │  ← row[] ↔ entity object
│                                             │    pure functions, no side effects
├─────────────────────────────────────────────┤
│  lib/            Utilities                  │  ← validate, errors, lock, cache,
│                                             │    uuid, datetime — stateless helpers
└─────────────────────────────────────────────┘
         ↓ only direction allowed ↓
         api → service → repository → mapper
                                   → lib (any layer may use lib)
```

**The dependency rule:** each layer only calls the layer below it. Repositories
never call services. Mappers never call repositories. `lib/` has no dependencies
on any other layer.

---

## 3. RPC surface — api.js

`api.js` is the **only** file whose top-level functions are exposed to the client
via `google.script.run`. It is a thin routing shim — no business logic lives here.

### Responsibilities
- Receive raw args from the client.
- Call `validate.*` on input.
- Delegate to the appropriate service.
- Return the result (JSON-serializable).
- Catch errors and re-throw as `AppError` (see §9).

### Pattern

```js
// api.js

function addItem(item) {
  validate.required(item, 'item');
  validate.string(item.name, 'name');
  return InventoryService.addItem(item);
}

function updateItem(item) {
  validate.required(item, 'item');
  validate.string(item.id, 'id');
  return InventoryService.updateItem(item);
}

function deleteItem(id) {
  validate.string(id, 'id');
  return InventoryService.deleteItem(id);
}

function getItems() {
  return InventoryService.getItems();
}
```

### Rules
- Functions must be **top-level named declarations** — GAS exposes globals to RPC.
  Never assign to a variable (`var addItem = function(){}` is not callable).
- Args and return values must be **JSON-serializable** — no Dates, class instances,
  or functions across the boundary.
- **No SpreadsheetApp here.** No sheet reads. No business decisions.
- **No try/catch here.** Let errors propagate; GAS surfaces them to the client as
  the rejection payload.
- One function per `ServerFunctions` entry — the signature here must match exactly.

---

## 4. Service layer — business logic

Services contain everything that answers "what should happen." They are the heart
of the backend.

### Responsibilities
- Enforce business rules (e.g. quantity cannot be negative).
- Orchestrate multiple repository calls when needed.
- Assign server-controlled fields (`id`, `updatedAt`, `createdAt`).
- Make cross-entity decisions.

### Pattern

```js
// services/inventoryService.js

var InventoryService = (function () {

  function getItems() {
    return ItemRepository.findAll();
  }

  function addItem(input) {
    if (input.quantity < 0) throw AppError.validation('quantity cannot be negative');
    var item = {
      id:        Uuid.generate(),
      name:      String(input.name).trim(),
      quantity:  Number(input.quantity),
      updatedAt: DateTime.nowIso(),
    };
    return ItemRepository.insert(item);
  }

  function updateItem(input) {
    var existing = ItemRepository.findById(input.id);
    if (!existing) throw AppError.notFound('Item', input.id);
    if (input.quantity < 0) throw AppError.validation('quantity cannot be negative');
    var updated = {
      id:        existing.id,
      name:      String(input.name).trim(),
      quantity:  Number(input.quantity),
      updatedAt: DateTime.nowIso(),
    };
    return ItemRepository.update(updated);
  }

  function deleteItem(id) {
    var existing = ItemRepository.findById(id);
    if (!existing) throw AppError.notFound('Item', id);
    return ItemRepository.remove(id);
  }

  return { getItems: getItems, addItem: addItem, updateItem: updateItem, deleteItem: deleteItem };

})();
```

### Rules
- **No SpreadsheetApp in services.** Sheet access is the repository's job.
- Services use `lib/` utilities freely (`Uuid`, `DateTime`, `AppError`, `Lock`).
- Business rules (minimum values, uniqueness checks, state machine transitions)
  live here and nowhere else.
- Name services after the domain noun: `InventoryService`, `UserService`.
- Wrap in an IIFE (`(function(){ ... })()`) to create a module-like namespace in
  GAS's global scope.

---

## 5. Repository layer — data access

Repositories are the only layer that touches `SpreadsheetApp`. They speak in
entities (objects), never in raw row arrays.

### Responsibilities
- Open/create the correct Sheet tab.
- Read rows → call mapper to produce entities.
- Receive entities → call mapper to produce row arrays → write to sheet.
- Wrap writes in `Lock` (see §10).

### Pattern

```js
// repositories/itemRepository.js

var ItemRepository = (function () {

  var SHEET_NAME = 'Items';
  var HEADERS    = ['id', 'name', 'quantity', 'updatedAt'];

  function getSheet() {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.setFrozenRows(1);
    }
    return sheet;
  }

  function findAll() {
    var sheet   = getSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    return sheet
      .getRange(2, 1, lastRow - 1, HEADERS.length)
      .getValues()
      .filter(function (row) { return row[0] !== '' && row[0] != null; })
      .map(ItemMapper.fromRow);
  }

  function findById(id) {
    return findAll().find(function (item) { return item.id === String(id); }) || null;
  }

  function findRowIndexById(id) {
    var sheet   = getSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return -1;
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(id)) return i + 2;
    }
    return -1;
  }

  function insert(item) {
    var lock = Lock.script();
    lock.waitLock(10000);
    try {
      getSheet().appendRow(ItemMapper.toRow(item));
    } finally {
      lock.releaseLock();
    }
    return item;
  }

  function update(item) {
    var lock = Lock.script();
    lock.waitLock(10000);
    try {
      var rowIndex = findRowIndexById(item.id);
      if (rowIndex === -1) throw AppError.notFound('Item', item.id);
      getSheet()
        .getRange(rowIndex, 1, 1, HEADERS.length)
        .setValues([ItemMapper.toRow(item)]);
    } finally {
      lock.releaseLock();
    }
    return item;
  }

  function remove(id) {
    var lock = Lock.script();
    lock.waitLock(10000);
    try {
      var rowIndex = findRowIndexById(id);
      if (rowIndex === -1) throw AppError.notFound('Item', id);
      getSheet().deleteRow(rowIndex);
    } finally {
      lock.releaseLock();
    }
    return { id: id };
  }

  return { findAll: findAll, findById: findById, insert: insert, update: update, remove: remove };

})();
```

### Rules
- `SpreadsheetApp` calls only in repositories. Nowhere else.
- Always batch I/O — one `getValues()` / `setValues()`, never cell-by-cell in a loop.
- Always wrap writes in `Lock.script()` (see §10).
- The repo returns entity objects (via mapper) — never raw `string[][]` row arrays.
- Name repositories after the noun + `Repository`: `ItemRepository`.

---

## 6. Transformation layer — mappers

Mappers are **pure functions** that convert between sheet row arrays and entity
objects. They have no side effects and no dependencies on GAS or other layers.

### Pattern

```js
// mappers/itemMapper.js

var ItemMapper = (function () {

  // row[]: [id, name, quantity, updatedAt]

  function fromRow(row) {
    return {
      id:        String(row[0]),
      name:      String(row[1]),
      quantity:  Number(row[2]) || 0,
      updatedAt: String(row[3]),
    };
  }

  function toRow(item) {
    return [item.id, item.name, item.quantity, item.updatedAt];
  }

  return { fromRow: fromRow, toRow: toRow };

})();
```

### Rules
- Mappers are **pure** — input in, output out, no I/O, no state, no GAS calls.
- Column order in `toRow` must match `HEADERS` in the repository exactly.
- Coerce types here — Sheets returns mixed types; always `String()` / `Number()`.
- If the entity shape changes, **only the mapper and the repository `HEADERS`
  change** — nothing else in the stack needs to know.
- One mapper per entity. Name: `EntityMapper` (e.g. `ItemMapper`).

---

## 7. Utility functions — lib/

`lib/` contains **custom backend code that is not part of GAS** — pure JavaScript
helpers with no external dependencies. These are importable in Node for unit
testing (no GAS runtime required).

### validate.js — argument validators

```js
// lib/validate.js

var validate = (function () {

  function required(value, name) {
    if (value === undefined || value === null)
      throw AppError.validation(name + ' is required');
  }

  function string(value, name) {
    required(value, name);
    if (typeof value !== 'string' || value.trim() === '')
      throw AppError.validation(name + ' must be a non-empty string');
  }

  function nonNegativeNumber(value, name) {
    var n = Number(value);
    if (isNaN(n) || n < 0)
      throw AppError.validation(name + ' must be a non-negative number');
  }

  function uuid(value, name) {
    var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(String(value)))
      throw AppError.validation(name + ' must be a valid UUID');
  }

  return { required: required, string: string, nonNegativeNumber: nonNegativeNumber, uuid: uuid };

})();
```

### errors.js — AppError + error codes

```js
// lib/errors.js

var ErrorCode = {
  VALIDATION:    'VALIDATION_ERROR',
  NOT_FOUND:     'NOT_FOUND',
  CONFLICT:      'CONFLICT',
  UNAUTHORIZED:  'UNAUTHORIZED',
  INTERNAL:      'INTERNAL_ERROR',
};

var AppError = (function () {

  function create(code, message, meta) {
    var err  = new Error(message);
    err.code = code;
    err.meta = meta || {};
    return err;
  }

  return {
    validation:   function (msg, meta)       { return create(ErrorCode.VALIDATION,   msg, meta); },
    notFound:     function (entity, id)      { return create(ErrorCode.NOT_FOUND,    entity + ' not found: ' + id, { entity: entity, id: id }); },
    conflict:     function (msg, meta)       { return create(ErrorCode.CONFLICT,     msg, meta); },
    unauthorized: function (msg)             { return create(ErrorCode.UNAUTHORIZED, msg); },
    internal:     function (msg, cause)      { return create(ErrorCode.INTERNAL,     msg, { cause: String(cause) }); },
    isAppError:   function (err)             { return err instanceof Error && !!err.code; },
  };

})();
```

### lock.js — LockService wrapper

```js
// lib/lock.js

var Lock = (function () {

  function script() {
    return LockService.getScriptLock();
  }

  function withLock(fn) {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      return fn();
    } finally {
      lock.releaseLock();
    }
  }

  return { script: script, withLock: withLock };

})();
```

### cache.js — CacheService wrapper

```js
// lib/cache.js

var Cache = (function () {

  var TTL_SECONDS = 300; // 5 min default

  function get(key) {
    var raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  }

  function set(key, value, ttl) {
    CacheService.getScriptCache().put(key, JSON.stringify(value), ttl || TTL_SECONDS);
  }

  function remove(key) {
    CacheService.getScriptCache().remove(key);
  }

  function getOrSet(key, fn, ttl) {
    var cached = get(key);
    if (cached !== null) return cached;
    var value = fn();
    set(key, value, ttl);
    return value;
  }

  return { get: get, set: set, remove: remove, getOrSet: getOrSet };

})();
```

### uuid.js — ID generation

```js
// lib/uuid.js

var Uuid = (function () {

  function generate() {
    return Utilities.getUuid();
  }

  return { generate: generate };

})();
```

### datetime.js — timestamp helpers

```js
// lib/datetime.js

var DateTime = (function () {

  function nowIso() {
    return new Date().toISOString();
  }

  function isValidIso(value) {
    return typeof value === 'string' && !isNaN(Date.parse(value));
  }

  return { nowIso: nowIso, isValidIso: isValidIso };

})();
```

### Rules for lib/
- **No GAS APIs** in `validate.js`, `errors.js`, `uuid.js`, `datetime.js` — these
  must run in Node. `lock.js` and `cache.js` wrap GAS APIs and are GAS-only.
- **No state** — every `lib/` module is stateless. No module-level variables that
  change at runtime.
- **No dependencies between lib files** — exception: `validate.js` may reference
  `AppError` since both are always loaded.
- Pure business utilities (slug generation, currency formatting, etc.) also belong
  in `lib/` — if it has no side effects and no GAS calls, it's a lib utility.

---

## 8. Validation

All validation happens **at the api layer** before the service is called.
Validators live in `lib/validate.js`.

### Two-tier approach

| Tier | Where | What |
|---|---|---|
| **Input validation** | `api.js` via `validate.*` | Presence, type, format — "is this a valid RPC call?" |
| **Business validation** | `services/*.js` via `AppError.*` | Rules — "does this operation make sense?" |

```js
// api.js — input tier
function addItem(item) {
  validate.required(item, 'item');
  validate.string(item.name, 'name');
  validate.nonNegativeNumber(item.quantity, 'quantity');
  return InventoryService.addItem(item);
}

// services/inventoryService.js — business tier
function addItem(input) {
  if (ItemRepository.existsByName(input.name))
    throw AppError.conflict('An item named "' + input.name + '" already exists');
  // ...
}
```

### Rules
- **Never trust client input.** Validate every RPC argument, even when the client
  also validates (the mock can be bypassed).
- **Validate once — at the boundary.** After `api.js` validates, services and
  repositories can assume input is structurally sound.
- Business rules (uniqueness, state, allowed transitions) go in services, not in
  validators.

---

## 9. Error handling

All server errors must surface as typed `AppError` instances so the client and
logs get consistent, actionable information.

### Error lifecycle

```
api.js     → validate.*  throws AppError.validation (caught by GAS, sent to client)
service    → throws AppError.notFound / .conflict / .internal
repository → throws AppError.notFound (row not found after locking)
lib        → throws AppError.validation
```

GAS sends the `Error.message` string to the client as the rejection payload. The
client (`server.ts`) receives it. The error code is available in server logs only.

### Rules
- **Always throw `AppError.*`, never `new Error(bare string)`** — so errors carry a code.
- **Log before re-throwing** when the error is unexpected (see §12).
- **No swallowing** — never `catch(e) {}` without at minimum `Logger.log(e)`.
- Predictable errors (not found, validation, conflict) — throw cleanly, no need to
  log. Unexpected errors (internal) — log the full stack, then throw `AppError.internal`.

---

## 10. Concurrency and locking

GAS does not guarantee single execution — multiple users can trigger concurrent
calls. Any read-then-write sequence is a race condition without a lock.

### Rule: wrap every write in `Lock.withLock()`

```js
// repositories/itemRepository.js

function insert(item) {
  return Lock.withLock(function () {
    getSheet().appendRow(ItemMapper.toRow(item));
    return item;
  });
}

function update(item) {
  return Lock.withLock(function () {
    var rowIndex = findRowIndexById(item.id);
    if (rowIndex === -1) throw AppError.notFound('Item', item.id);
    getSheet().getRange(rowIndex, 1, 1, HEADERS.length).setValues([ItemMapper.toRow(item)]);
    return item;
  });
}
```

- `Lock.withLock` waits up to **10 seconds** for the lock. Callers that cannot
  acquire it will throw — surface this as `AppError.internal` in `api.js`.
- **Read-only operations (`findAll`, `findById`) do not need locks.** Locking on
  reads kills throughput for no benefit in this data model.
- GAS script lock is process-wide — one concurrent mutation at a time per script.
  This is appropriate for a Sheets backend; use property locks only if sub-sheet
  isolation is ever needed.

---

## 11. Caching

Sheets I/O is the primary performance bottleneck. Cache hot reads with
`CacheService` (max 6 hours, max 100KB per entry).

### Pattern — cache-aside in the repository

```js
// repositories/itemRepository.js

var CACHE_KEY = 'items_all';

function findAll() {
  return Cache.getOrSet(CACHE_KEY, function () {
    var sheet   = getSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    return sheet
      .getRange(2, 1, lastRow - 1, HEADERS.length)
      .getValues()
      .filter(function (row) { return row[0] !== '' && row[0] != null; })
      .map(ItemMapper.fromRow);
  }, 300);
}

function insert(item) {
  return Lock.withLock(function () {
    getSheet().appendRow(ItemMapper.toRow(item));
    Cache.remove(CACHE_KEY);   // ← always invalidate on write
    return item;
  });
}
```

### Rules
- **Invalidate on every write** (`insert`, `update`, `remove`) — stale reads are
  worse than slow reads.
- Cache keys must be **unique and deterministic**: `'items_all'`, `'item_' + id`.
- Do not cache inside services — caching is a data-access concern (repository level).
- `CacheService` stores strings; `Cache.get/set` wraps `JSON.parse/stringify`.
- Maximum safe cache value: ~90KB (leave 10KB headroom under the 100KB limit).
  For larger lists, cache a page or don't cache at all.

---

## 12. Logging

GAS logs via `console.log` → Stackdriver. Tail with `npm run logs`.

### Structured log format

```js
// Any layer may log. Prefer structured objects over plain strings.

console.log(JSON.stringify({
  fn:      'InventoryService.addItem',
  item:    item.id,
  ms:      Date.now() - start,
  success: true,
}));

// On unexpected errors:
console.error(JSON.stringify({
  fn:    'ItemRepository.update',
  error: err.message,
  code:  err.code,
  stack: err.stack,
}));
```

### Rules
- **Always log at the api layer** — record function name, key args, duration.
- **Log unexpected errors at the point of catch** before re-throwing.
- **Never log sensitive data** (passwords, tokens, full user payloads).
- For performance tracing: record `ms` as `Date.now() - start` at the service level.

---

## 13. TypeScript contract

The server is **plain JavaScript** (GAS V8 runs it without transpilation), but it
is typechecked out-of-band via `src/server/contract.ts` + `tsconfig.server.json`.

### contract.ts (compile-time only, never pushed)

```ts
// src/server/contract.ts
import type { ServerFunctions } from '@shared/types';
declare const _api: ServerFunctions;
export {};
```

This file forces `tsc` to verify the hand-written `api.js` globals structurally
match `ServerFunctions`. It is **never pushed** to GAS — `copy-server.mjs` skips
`.ts` files.

### Rules
- **`src/shared/types.ts` is the single source of truth** for entity types and the
  RPC surface. Edit it first; then update the server.
- Run `npm run typecheck` before every deploy — it catches client/server drift.
- Use JSDoc `@param` / `@returns` annotations in `.js` files to get IDE
  type-inference without TypeScript compilation.

---

## 14. GAS-specific rules

Hard constraints that differ from conventional Node/Express backends.

| Rule | Reason |
|---|---|
| **Top-level named functions only** in `api.js` | `google.script.run` only discovers global named declarations. |
| **No ES modules** (`import`/`export`) | GAS V8 does not support ESM. Use IIFE module pattern. |
| **No `require()`** | GAS is not Node. No CommonJS. |
| **All values across the RPC boundary must be JSON-serializable** | `google.script.run` serializes via structured clone. No Dates, classes, functions. |
| **Execution cap: ~6 minutes** | GAS kills scripts at 6 min. Never do unbounded loops over large sheets in a single call. |
| **`SpreadsheetApp` only in repositories** | Centralizing I/O makes the 6 min cap manageable and performance visible. |
| **`LockService` on all writes** | Stateless-per-call execution means concurrent calls are common. |
| **`CacheService` max 6 hours / 100KB** | Design cache keys and TTLs with these limits in mind. |
| **No persistent process** | No singleton state, no module-level caches that survive between calls (except `CacheService`). |
| **`console.log` → Stackdriver only** | There is no stdout; tail logs with `npm run logs`. |
