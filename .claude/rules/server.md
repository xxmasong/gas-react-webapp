---
paths:
  - "src/server/**/*.js"
  - "src/server/**/*.ts"
---

# Server layer rules

You are editing the GAS backend. These rules are absolute.

## Layer you are in

`api.js → service → repository → mapper` — identify which layer the file belongs to before writing.

## api.js
- Top-level **named function declarations only** — `function foo(token, input) {}`
- Never arrow functions, never `const foo =`, never `export`
- Order always: `AuthService.requireRole/requireUser → validate.xxx → delegate → return`
- Never catch errors — let them propagate

## services/
- All business logic lives here — not in api.js, not in repositories
- Throw `AppError.notFound`, `AppError.conflict`, `AppError.validation` — never return null on error
- Computed fields (`qtyTotal`, `kyteMatch`, `costTotal`) must be recalculated on every write
- Cost/price fields preserved from DB on update — never overwrite from client input

## repositories/
- One `getRange().getValues()` call per read operation — never cell-by-cell
- Every write inside `Lock.withLock(fn)` — no exceptions
- `Cache.remove(CACHE_KEY)` immediately after every mutation
- Read pattern: `Cache.getOrSet(KEY, () => sheet.getRange(...).getValues().filter().map(Mapper.fromRow), TTL)`

## mappers/
- Pure functions only — `fromRow(row[])` and `toRow(entity)` — zero I/O, zero service calls
- Column order must match `HEADERS` exactly
- `fromRow` must handle null/empty cells: `String(row[N] || '')`, `Number(row[N]) || 0`

## lib/
- Stateless helpers only — no dependencies on other layers
- Add new validators to `validate.js` and expose on the return object
- Throw `AppError.validation(msg)` from validators, never return false

## GAS rules (non-negotiable)
- No `import`/`export` anywhere — GAS V8 rejects ES modules
- All variables via IIFE: `var Foo = (function() { ... return { ... }; })();`
- `Uuid.generate()` only for IDs — never `Math.random()` or client values
- `DateTime.nowIso()` for all timestamps
- `console.log` goes to Stackdriver — use it for debugging
