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

> Steps 3–6 follow the canonical code templates in `.claude/rules/server.md` (auto-loaded when you edit `src/server/**`). Don't restate them — copy the template and adapt.

### Step 3 — `src/server/repositories/${feature}Repository.js`
Repository template in `rules/server.md`. `SHEET_NAME`/`HEADERS`/`CACHE_KEY` from Config; `findAll` via `Cache.getOrSet` + batch `getValues()`; all writes in `Lock.withLock()` + `Cache.remove()` after.

### Step 4 — `src/server/mappers/${feature}Mapper.js`
Mapper template in `rules/server.md`. Pure `fromRow`/`toRow`; column order matches `HEADERS`; handle null cells.

### Step 5 — `src/server/services/${feature}Service.js`
Service template in `rules/server.md`. All business rules + computed fields here; throw `AppError.notFound/conflict/validation`. `add`: uniqueness → compute → `Uuid.generate()` + `DateTime.nowIso()`. `update`: `findById` → preserve read-only fields → recompute. `remove`: check dependents.

### Step 6 — `src/server/api.js`
api.js + validator templates in `rules/server.md`. One named function declaration per op (`auth → validate → delegate → return`); add `validate.$feature` to `src/server/lib/validate.js`.

---

### Step 7 — client bridge (same commit as api.js)

Templates in `.claude/rules/contract.md`.
- `src/client/lib/server.ts` — add entries to the exported `server` object: `fn: (...args) => authed('fn', ...args)`
- `src/client/lib/serverMock.ts` — add entries to `createMock()` (token is first arg, sync return); mock returns full shape incl. computed fields, local `uuid()` id, `new Date().toISOString()` updatedAt.

---

### Step 8 — `src/client/features/$feature/`

Hook pattern + atomic levels in `.claude/rules/client.md` (auto-loaded for `src/client/**`).
- `hooks/use${feature}s.ts` — follows the hook template; all `server.*` calls live here
- `components/` — feature-local UI (respect atomic levels)
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
