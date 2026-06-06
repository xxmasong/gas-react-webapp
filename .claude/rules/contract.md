---
paths:
  - "src/shared/types.ts"
  - "src/client/lib/server.ts"
  - "src/client/lib/serverMock.ts"
---

# Contract rules

You are editing the RPC contract. These three files must always be in sync.

## The three-file contract

| File | Role |
|---|---|
| `src/shared/types.ts` | Source of truth — every function signature and entity type |
| `src/server/api.js` | Server implementation — one named function per ServerFunctions entry |
| `src/client/lib/server.ts` | Real bridge — one entry per function in the exported `server` object |
| `src/client/lib/serverMock.ts` | Mock bridge — `createMock()` returns one entry per function |

**Any change to one file requires checking the other three.** (`type ServerFunctions` is structurally typed, so a missing `server`/mock key only fails at call time — `npm run verify:contract` catches it deterministically.)

## types.ts rules

- `type` over `interface` — no exceptions
- `ServerFunctions` must list every callable function with exact arg + return types
- All args and returns must be JSON-serializable — no `Date`, no class instances
- Computed/server-assigned fields go in the full entity type, not in `New<Entity>` input types
- `New<Entity>` = `Omit<Entity, 'id' | 'updatedAt' | computed_fields>`

## server.ts rules (real bridge)

- `src/client/lib/server.ts` exports the `server` object — one entry per function
- `token` is injected by `authed('fn', ...)` — view/hook code never passes it
- Entry form: `addCategory: (cat: NewSkuCategory) => authed('addCategory', cat)`
- `login` is the only call via `call('login', ...)` (unauthenticated, no token)

## serverMock.ts rules (mock bridge)

- `createMock(): ServerFunctions` returns one entry per function
- The mock implements `ServerFunctions` directly, so each entry **takes `token` as its first arg** (except `login`) — matching the real api.js signature, not the token-injected `server` shape
- Entries are **synchronous** (return the value; the bridge wraps in `Promise.resolve`)
- Use the local `uuid()` helper for ids, `new Date().toISOString()` for timestamps
- Mock must mirror real service: same output shape, same computed fields, same validation/throws

## Mock parity checklist (run after any api.js change)

For each function in `ServerFunctions`:
1. Does `api.js` have a top-level named function declaration for it? ✓
2. Does the `server` object in `server.ts` have a matching entry? ✓
3. Does `createMock()` in `serverMock.ts` have a matching entry? ✓
4. Does the mock return the correct shape including all computed fields? ✓

Run `npm run typecheck:all` (includes `verify:contract`) — green = contract in sync.

## Canonical entries (real + mock, same commit)

```ts
// server.ts — in the exported `server` object (token injected by authed):
addCategory: (cat: NewSkuCategory) => authed('addCategory', cat),

// serverMock.ts — in the createMock() return object (token is a real first arg, sync):
addCategory: (token, cat) => {
  requireRole(token, 'supervisor');
  const entity: SkuCategory = { ...cat, id: uuid(), updatedAt: new Date().toISOString() };
  mockCategories.push(entity);
  return entity;
},
```
