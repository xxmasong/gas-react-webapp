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

server.ts buildServer keys:
!`grep -n ":.*authed\|:.*call(" src/client/lib/server.ts`

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

### Step 5 — `src/client/lib/server.ts` (same commit)
Real call in `buildServer()` + mock in `createMock()` mirroring real output shape (template in `rules/contract.md`).

---

### Step 6 — Update CLAUDE.md

Add row to the correct table in `CLAUDE.md` § API Surface.

---

### Verify

```bash
npm run typecheck:all
```
