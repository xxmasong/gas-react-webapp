---
name: deploy-check
description: Run the full pre-deploy gate before npm run deploy:version. Checks typecheck, mock parity, contract sync, config, roles, routes, and docs.
allowed-tools: "Read Glob Grep Bash(npm run typecheck:all) Bash(npm run build)"
---

# Pre-deploy gate

## Live state

Typecheck result:
!`npm run typecheck:all 2>&1 | tail -5`

api.js functions:
!`grep -n "^function " src/server/api.js`

ServerFunctions in types.ts:
!`grep -n "^  [a-zA-Z]" src/shared/types.ts | grep -v "//"`

server.ts buildServer:
!`grep -n "authed\|call(" src/client/lib/server.ts | grep -v "//"`

Git diff summary:
!`git diff --name-only HEAD~1 HEAD 2>/dev/null || git diff --name-only --cached`

---

## Gate — work through every item. Stop and fix before continuing.

### 1. Typecheck
Must show zero errors. If it failed above, fix all errors now before proceeding.

### 2. Mock parity
For every function in `api.js`, confirm `server.ts` has:
- [ ] Real call in `buildServer()`
- [ ] Mock in `createMock()` with correct output shape

List any missing. Fix them.

### 3. Contract sync
For every function in `ServerFunctions`:
- [ ] Exists as named function in `api.js`
- [ ] Has entry in `buildServer()`
- [ ] Has entry in `createMock()`

List any gaps. Fix them.

### 4. Config completeness
For any new Sheet tab:
- [ ] `SHEETS` key in `config.js`
- [ ] `CACHE_TTL` key
- [ ] `CACHE_KEYS` key

### 5. Role gates
For every new api.js function:
- [ ] First line is `AuthService.requireRole` or `AuthService.requireUser`

### 6. Routes
For any new page:
- [ ] Path constant in `routes/paths.ts`
- [ ] `<Route>` in `PrivateApp.tsx` / `MobileApp.tsx`
- [ ] `<RequireRole>` if role-gated
- [ ] Routes table in `CLAUDE.md` updated

### 7. CLAUDE.md sync
- [ ] `CLAUDE.md` § API Surface reflects new/changed functions
- [ ] `CLAUDE.md` § Data Model reflects schema changes
- [ ] `CLAUDE.md` § Business Rules reflects new rules

### 8. Build
```bash
npm run build
```
Must complete without errors.

### 9. Deploy
All items above checked? Then:
```bash
npm run deploy:version
```

### 10. Smoke check
After deploy: open app, log in, exercise changed feature, check `npm run logs` for errors.
