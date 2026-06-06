---
name: new-rpc
description: Add a single new RPC function to an existing service. Pass the function name as argument.
argument-hint: "[functionName]"
arguments: fn
allowed-tools: "Read Glob Grep Edit Write Bash(npm run typecheck:all)"
---

# New RPC: $fn

## Dynamic context — current state

ServerFunctions in types.ts:
!`grep -n "^  [a-zA-Z]" src/shared/types.ts | grep -v "//"`

api.js functions:
!`grep -n "^function " src/server/api.js`

server.ts `server` object keys:
!`grep -n ":.*authed\|:.*call(" src/client/lib/server.ts`

serverMock.ts createMock keys:
!`grep -nE "^\s+[a-zA-Z]+:" src/client/lib/serverMock.ts | head -40`

---

## Instructions

Adding RPC function **$fn**. If $fn is empty, ask: function name, args + types, return type, min role, which service handles it.

---

### Step 1 — `src/shared/types.ts`

Add to `ServerFunctions`:
```ts
$fn(token: string, /* args */): ReturnType;
```
If a new input shape is needed, define `type New<X>` above `ServerFunctions`. Run `npm run typecheck:all`.

---

> Templates: service/validator/api.js shapes in `.claude/rules/server.md`; server.ts entry in `.claude/rules/contract.md`. Copy and adapt — don't reinvent.

### Step 2 — Service method
Add `$fn` to the relevant service IIFE return object. Business logic + `AppError` on violations; `Uuid.generate()` / `DateTime.nowIso()` as needed.

### Step 3 — Validator (if needed)
Add `validate.inputName` to `src/server/lib/validate.js` (validator template in `rules/server.md`).

### Step 4 — `src/server/api.js`
Named function declaration: `auth → validate → delegate → return`. Min role via `_getRole()`.

### Step 5 — client bridge (same commit)
- `src/client/lib/server.ts` — add entry to the exported `server` object: `$fn: (...args) => authed('$fn', ...args)`
- `src/client/lib/serverMock.ts` — add entry to `createMock()` (token is first arg, sync return), mirroring real output shape
Template in `rules/contract.md`.

---

### Step 6 — Update CLAUDE.md

Add row to the correct table in `CLAUDE.md` § API Surface.

---

### Verify

```bash
npm run typecheck:all
```
