---
name: verify-contract
description: Audit and fix contract drift between types.ts, api.js, and server.ts. Run this whenever RPC functions may be out of sync.
allowed-tools: "Read Grep Edit Bash(npm run typecheck:all) Bash(npm run verify:contract)"
---

# Verify contract

## Live state of all three files

### types.ts — ServerFunctions
!`grep -A 200 "export type ServerFunctions" src/shared/types.ts | grep -E "^\s+[a-zA-Z].*\("`

### api.js — top-level functions
!`grep "^function " src/server/api.js`

### server.ts — `server` object keys (real bridge)
!`grep -A 100 "export const server" src/client/lib/server.ts | grep -E "^\s+[a-zA-Z]+:" | head -40`

### serverMock.ts — createMock() keys (mock bridge)
!`grep -A 200 "createMock" src/client/lib/serverMock.ts | grep -E "^\s+[a-zA-Z]+:" | head -40`

---

## Instructions

### 1. Run the deterministic name-set check first
```bash
npm run verify:contract
```
This compares the SET of function names across all four surfaces (`ServerFunctions`,
`api.js` functions, the `server` object in `server.ts`, `createMock()` in `serverMock.ts`)
and lists exactly which surface any name is missing from. Fix every gap it reports.

> The four contract surfaces: **types.ts** `ServerFunctions` (source of truth) → **api.js**
> top-level function → **server.ts** `server` object entry (token injected by `authed`) →
> **serverMock.ts** `createMock()` entry (token is a real first arg, sync return).

### 2. Mock shape audit (what the script can't see)
The script checks names, `tsc` checks arg/return types. Neither checks *semantic* shape.
For each `createMock()` entry in `serverMock.ts`, confirm its return value matches the real
service output:
- `qtyTotal`, `kyteMatch`, `costTotal` computed on InventoryItem mocks?
- `updatedAt` always set?
- Same validation/throws as the real service?

### 3. Fix all gaps, then confirm
```bash
npm run typecheck:all
```
Runs both tsc projects **and** `verify:contract`. Zero errors = contract is in sync.
