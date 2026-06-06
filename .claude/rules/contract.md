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
| `src/client/lib/server.ts` | Client bridge — real call in `buildServer()` + mock in `createMock()` |

**Any change to one file requires checking the other two.**

## types.ts rules

- `type` over `interface` — no exceptions
- `ServerFunctions` must list every callable function with exact arg + return types
- All args and returns must be JSON-serializable — no `Date`, no class instances
- Computed/server-assigned fields go in the full entity type, not in `New<Entity>` input types
- `New<Entity>` = `Omit<Entity, 'id' | 'updatedAt' | computed_fields>`

## server.ts rules

- `token` is injected by `authed()` — client-facing functions never take token as arg
- `buildServer()` entry: `funcName: (...clientArgs) => authed('funcName', ...clientArgs)`
- `createMock()` entry must mirror real service: same output shape, same computed fields
- Mock must be realistic — correct field types, correct computed field values

## Mock parity checklist (run after any api.js change)

For each function in `ServerFunctions`:
1. Does `api.js` have a top-level named function declaration for it? ✓
2. Does `buildServer()` in `server.ts` have a matching entry? ✓
3. Does `createMock()` in `server.ts` have a matching entry? ✓
4. Does the mock return the correct shape including all computed fields? ✓

Run `npm run typecheck:all` — if it passes, the contract is in sync.
