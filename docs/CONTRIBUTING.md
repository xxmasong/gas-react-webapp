# Contributing — add or change a feature

The end-to-end recipe for this stack. The golden rule: **start at the contract,
end at the deploy.** Every change flows through `src/shared/types.ts`.

## The recipe

### 1. Define the contract — `src/shared/types.ts`
Add or change the entity type and its functions on `ServerFunctions`:

```ts
export interface Item { id: string; name: string; quantity: number; updatedAt: string; }
export type NewItem = Pick<Item, 'name' | 'quantity'>;

export interface ServerFunctions {
  getItems(): Item[];
  addItem(item: NewItem): Item;
  // ...add your new function signature here
}
```
Arguments and returns must be **JSON-serializable** (RPC crosses a process boundary).

### 2. Add the RPC shim — `src/server/api.js`
A top-level named function. Keep it thin: **validate, delegate, return.** No business
logic and no `SpreadsheetApp` here.

```js
function addItem(item) {
  validate.required(item, 'item');
  validate.string(item.name, 'name');
  validate.nonNegativeNumber(item.quantity, 'quantity');
  return InventoryService.addItem(item);                 // delegate to the service
}
```

### 3. Implement the business logic — `src/server/services/<name>Service.js`
The service (an IIFE global, e.g. `InventoryService`) owns the rules: reject invalid
state, assign server-side fields (`id` via `Uuid.generate()`, `updatedAt` via
`DateTime.nowIso()`), trim/coerce input, then call the repository.

```js
function addItem(input) {
  if (input.quantity < 0) throw AppError.validation('quantity cannot be negative');
  var item = {
    id: Uuid.generate(), name: String(input.name).trim(),
    quantity: Number(input.quantity), updatedAt: DateTime.nowIso(),
  };
  return ItemRepository.insert(item);
}
```

### 4. Persist it — `src/server/repositories/<name>Repository.js` (+ `mappers/`)
The data-access layer (an IIFE global, e.g. `ItemRepository`) is the **only** code that
touches `SpreadsheetApp`. If the schema changes, update `HEADERS` and the matching
`mappers/<name>Mapper.js` (`fromRow`/`toRow`). Wrap every write in `Lock.withLock` and
invalidate the cache key. See [DATA_MODEL.md](DATA_MODEL.md) and
[BUSINESS_LOGIC.md §4](BUSINESS_LOGIC.md).

### 5. Wire the client bridge — `src/client/lib/server.ts`
Add a typed wrapper **and** a mock branch (mock parity is required):

```ts
export const server = {
  // ...
  addItem: (item: NewItem) => call('addItem', item),
};

// inside createMock():
addItem: (item) => { /* in-memory mirror of the server behaviour */ },
```
(`src/client/server.ts` is only a re-export shim — edit `lib/server.ts`.)

### 6. Build the UI
Add a feature view + a `useXxx()` hook that wraps `server.*` and owns
loading/error/optimistic state. Components never call `server.*` directly through
`google.script.run`; they go through the hook → `server.ts`.

### 7. Verify and ship
```bash
npm run typecheck   # catches client/contract drift
npm run dev         # exercise the UI against the mock
npm run deploy      # build + push to the live app
```

## Definition of done

- [ ] `ServerFunctions` updated in `src/shared/types.ts`.
- [ ] `api.js` shim added (validate → delegate); logic in `services/`.
- [ ] Repository + `mappers/` + `HEADERS` updated; writes wrapped in `Lock.withLock`; cache invalidated.
- [ ] Client wrapper **and** mock branch added in `src/client/lib/server.ts`.
- [ ] `npm run typecheck` passes.
- [ ] Verified locally against the mock, then deployed.

## Code conventions

- TypeScript on the client/shared; plain modern JS on the server (GAS V8).
- Server modules are **IIFE globals** (`var ItemRepository = (function(){…})();`);
  only `api.js` uses bare top-level function declarations (so RPC can call them).
- Keep `api.js` functions as routing shims; push real logic down a layer.
- Only `repositories/*` import/use `SpreadsheetApp`.
- No new runtime deps that break single-file inlining.
