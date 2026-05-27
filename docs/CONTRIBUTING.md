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

### 2. Implement the server function — `src/server/api.js`
A top-level named function. Keep it thin: validate, delegate, return.

```js
function addItem(item) {
  if (!item || !item.name) throw new Error('name is required');   // validate
  var created = {
    id: Utilities.getUuid(),
    name: String(item.name),
    quantity: Number(item.quantity) || 0,
    updatedAt: new Date().toISOString(),
  };
  return insertItem_(created);                                    // delegate to DAL
}
```
Business logic that is more than trivial belongs in `src/server/services/`, not here.

### 3. Persist it — `src/server/sheets.js`
The data-access layer. If the schema changes, update `HEADERS` and the row mappers.
See [DATA_MODEL.md](DATA_MODEL.md) for the Sheets conventions and the `LockService`
requirement on writes.

### 4. Wire the client bridge — `src/client/server.ts`
Add a typed wrapper **and** a mock branch (mock parity is required):

```ts
export const server = {
  // ...
  addItem: (item: NewItem) => call('addItem', item),
};

// inside createMock():
addItem: (item) => { /* in-memory mirror of the server behaviour */ },
```

### 5. Build the UI
Add a feature view + a `useXxx()` hook that wraps `server.*` and owns
loading/error/optimistic state. Components never call `server.*` directly through
`google.script.run`; they go through the hook → `server.ts`.

### 6. Verify and ship
```bash
npm run typecheck   # catches client/contract drift
npm run dev         # exercise the UI against the mock
npm run deploy      # build + push to the live app
```

## Definition of done

- [ ] `ServerFunctions` updated in `src/shared/types.ts`.
- [ ] Server function implemented (thin in `api.js`; logic in `services/`).
- [ ] DAL + `HEADERS` updated; writes wrapped in `LockService`.
- [ ] Client wrapper **and** mock branch added in `server.ts`.
- [ ] `npm run typecheck` passes.
- [ ] Verified locally against the mock, then deployed.

## Code conventions

- TypeScript on the client/shared; plain modern JS on the server (GAS V8).
- Server DAL helpers are suffixed `_` (e.g. `insertItem_`) by convention — these
  are internal and not part of the RPC surface.
- Keep `api.js` functions as routing shims; push real logic down a layer.
- Only `sheets.js` imports/uses `SpreadsheetApp`.
- No new runtime deps that break single-file inlining.
