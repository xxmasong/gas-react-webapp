---
name: add-feature
description: Add a complete new feature end-to-end: types → repository → mapper → service → api → client bridge → hook → route. Pass the feature name as argument.
argument-hint: "[FeatureName]"
arguments: feature
allowed-tools: "Read Glob Grep Edit Write Bash(npm run typecheck:all)"
---

# Add Feature: $feature

## Dynamic context — current contract state

Current ServerFunctions:
!`grep -n "^  [a-zA-Z]" src/shared/types.ts | grep -v "//" | head -40`

Current api.js functions:
!`grep -n "^function " src/server/api.js`

Current server.ts exports:
!`grep -n "^  [a-zA-Z]" src/client/lib/server.ts | head -40`

---

## Instructions

You are implementing the feature **$feature** end-to-end. Follow every step in order. Do not skip. Mark each complete before moving on.

If `$feature` is empty, ask the user for: feature name, entity fields, RPC functions needed, minimum role per operation, which app(s) (PrivateApp/MobileApp/both).

---

### Step 1 — `src/shared/types.ts`

Add:
- `type $feature = { id: string; /* entity fields */; updatedAt: string; }`
- `type New$feature = Omit<$feature, 'id' | 'updatedAt' | /* computed fields */>`
- Function signatures in `ServerFunctions`

Run: `npm run typecheck:all` — fix all errors before continuing.

---

### Step 2 — `src/server/config.js`

Add to `SHEETS`, `CACHE_TTL`, `CACHE_KEYS`:
```js
// In SHEETS:
$feature: '$feature',

// In CACHE_TTL:
$feature: 300,

// In CACHE_KEYS:
$feature: '${feature}_all',
```

---

### Step 3 — `src/server/repositories/${feature}Repository.js`

Use the repository pattern from CLAUDE.md § Code Patterns exactly:
- `SHEET_NAME`, `HEADERS`, `CACHE_KEY` from Config
- `getSheet()` auto-creates tab + frozen header row
- `findAll()` via `Cache.getOrSet` → batch `getValues()` → filter → `Mapper.fromRow`
- `findById()` from `findAll()`
- `insert()`, `update()`, `remove()` all inside `Lock.withLock()` with `Cache.remove()` after

---

### Step 4 — `src/server/mappers/${feature}Mapper.js`

Pure functions only:
- `fromRow(row)` — handle null/empty: `String(row[N] || '')`, `Number(row[N]) || 0`
- `toRow(entity)` — column order must match `HEADERS` exactly

---

### Step 5 — `src/server/services/${feature}Service.js`

IIFE pattern. Business rules:
- `add`: uniqueness checks → compute fields → `Uuid.generate()` + `DateTime.nowIso()` → insert
- `update`: `findById` → throw `AppError.notFound` if missing → merge → preserve read-only fields → recompute
- `remove`: `findById` → throw if missing → check dependents → remove
- Throw `AppError.notFound/conflict/validation` — never return null on error

---

### Step 6 — `src/server/api.js`

One **named function declaration** per operation. No arrow functions. No exports.
```js
function list$features(token) {
  AuthService.requireUser(token);
  return ${feature}Service.list();
}
function add$feature(token, input) {
  AuthService.requireRole(token, _getRole().SUPERVISOR);
  validate.$feature(input);
  return ${feature}Service.add(input);
}
```

Also add `validate.$feature` to `src/server/lib/validate.js`.

---

### Step 7 — `src/client/lib/server.ts` (same commit as api.js)

Real calls in `buildServer()` + mocks in `createMock()`. Mock must:
- Return correct shape including all computed fields
- Use `crypto.randomUUID()` for id
- Use `new Date().toISOString()` for updatedAt

---

### Step 8 — `src/client/features/$feature/`

Create:
- `hooks/use${feature}s.ts` — follows hook pattern from CLAUDE.md § Code Patterns
- `components/` — feature-local UI
- `index.ts` — exports only the routable page component

---

### Step 9 — Route (if new page)

1. Add `$FEATURE: '/$feature'` to `src/client/routes/paths.ts`
2. Add `<Route>` to `PrivateApp.tsx` / `MobileApp.tsx`
3. Wrap with `<RequireRole role="...">` if role-gated
4. Update Routes table in `CLAUDE.md`

---

### Step 10 — Final verification

```bash
npm run typecheck:all
```

Must pass with zero errors. Also verify:
- [ ] Mock matches real service output shape
- [ ] Sheet tab name in config.js
- [ ] Role gate in api.js
- [ ] CLAUDE.md § API Surface updated
- [ ] CLAUDE.md § Data Model updated if new schema
