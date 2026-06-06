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

### Step 2 — Service method

Add to the relevant service's IIFE return object:
```js
var $fn = (/* args */) => {
  // business logic — throw AppError on violations
  // Uuid.generate() for ids, DateTime.nowIso() for timestamps
};
return { ...existing, $fn };
```

---

### Step 3 — Validator (if needed)

Add to `src/server/lib/validate.js` return object:
```js
var inputName = (input) => {
  required(input, 'input');
  string(input.field, 'field');
};
```

---

### Step 4 — `src/server/api.js`

Named function declaration:
```js
function $fn(token, /* args */) {
  AuthService.requireRole(token, _getRole().ROLE);
  validate.inputName(arg);
  return ServiceName.$fn(/* args */);
}
```

---

### Step 5 — `src/client/lib/server.ts` (same commit)

```ts
// buildServer():
$fn: (/* clientArgs */) => authed('$fn', /* clientArgs */),

// createMock():
$fn: async (/* clientArgs */) => {
  // mirror real output shape
},
```

---

### Step 6 — Update CLAUDE.md

Add row to the correct table in `CLAUDE.md` § API Surface.

---

### Verify

```bash
npm run typecheck:all
```
