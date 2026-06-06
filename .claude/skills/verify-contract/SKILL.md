---
name: verify-contract
description: Audit and fix contract drift between types.ts, api.js, and server.ts. Run this whenever RPC functions may be out of sync.
allowed-tools: "Read Grep Edit Bash(npm run typecheck:all)"
---

# Verify contract

## Live state of all three files

### types.ts — ServerFunctions
!`grep -A 200 "export type ServerFunctions" src/shared/types.ts | grep -E "^\s+[a-zA-Z].*\("`

### api.js — top-level functions
!`grep "^function " src/server/api.js`

### server.ts — buildServer keys
!`grep -A 100 "buildServer" src/client/lib/server.ts | grep -E "^\s+[a-zA-Z]+:" | head -30`

### server.ts — createMock keys
!`grep -A 100 "createMock" src/client/lib/server.ts | grep -E "^\s+[a-zA-Z]+:" | head -30`

---

## Instructions

Using the live state above, perform this audit:

### 1. types.ts → api.js
Every function in `ServerFunctions` must have a matching top-level named function declaration in `api.js`.
List any missing from `api.js`.

### 2. api.js → types.ts
Every top-level function in `api.js` must have a signature in `ServerFunctions`.
List any missing from `types.ts`.

### 3. types.ts → buildServer()
Every function in `ServerFunctions` must have a key in `buildServer()`.
List any missing from `buildServer()`.

### 4. types.ts → createMock()
Every function in `ServerFunctions` must have a key in `createMock()`.
List any missing from `createMock()`.

### 5. Mock shape audit
For each function in `createMock()`, does its return value match the real service's output shape? Check computed fields:
- `qtyTotal`, `kyteMatch`, `costTotal` present on InventoryItem mocks?
- `updatedAt` always set?
- No extra fields that don't exist in the type?

### 6. Fix all gaps found
Add missing functions, fix shapes. Then:

```bash
npm run typecheck:all
```

Zero errors = contract is in sync.
