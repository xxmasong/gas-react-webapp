# KNOWLEDGE.md — GAS React Web App (Claude-internal cache, NOT a developer doc)

> Audience: **Claude only.** This is a context cache for fast recall — read it
> first to skip re-deriving structure; open source files only when editing.
> It is **not** developer documentation. Human-facing docs live elsewhere:
>   - `README.md` (root) — quick start + doc index
>   - `docs/` — ARCHITECTURE, DEVELOPMENT, CONTRIBUTING, DATA_MODEL, DEPLOYMENT,
>     TROUBLESHOOTING, DEPLOY_URL (all dev docs now consolidated under docs/)
> When asked to document something for humans, edit those — not this file.
> Use this file freely to compress/cache facts, store working memory, and note
> decisions so future sessions stay cheap.

## What this is

A Google Apps Script **web app** (`script.google.com/macros/s/.../exec`) with a
**React + Vite** frontend and **Google Sheets as the backend database**. Based on
the architecture from `enuchi/React-Google-Apps-Script` (Vite + gas-client + clasp),
slimmed to a single app.

## Hard constraints (why the design is what it is)

- **GAS HtmlService serves ONE self-contained HTML file.** No external JS/CSS.
  → Vite + `vite-plugin-singlefile` inlines everything into `dist/index.html`.
- **`google.script.run` is the only browser→server channel** (no fetch to GAS).
  → `gas-client` wraps it as promises. See `src/client/server.ts`.
- **Server functions must be top-level named globals** to be callable.
  → `src/server/api.js` exposes `getItems/addItem/updateItem/deleteItem`.
- **clasp pushes a flat `rootDir`.** HTML + `.js` + `appsscript.json` sit together.
  → `scripts/copy-server.mjs` assembles `dist/` after the Vite build.

## File map

| Path | Role |
|---|---|
| `index.html` | Vite entry (dev). Built → `dist/index.html` (the served app). |
| `src/client/main.tsx` | React mount. |
| `src/client/App.tsx` | Shell: layout + badge, mounts `<InventoryView>`. No business logic. |
| `src/client/lib/server.ts` | **Typed RPC bridge** (canonical). Real gas-client in GAS; in-memory mock during dev. |
| `src/client/server.ts` | Re-export shim → `lib/server.ts`. |
| `src/client/styles.css` | Styling. |
| `src/client/vite-env.d.ts` | `google` global shim + vite client types. |
| `src/client/features/inventory/hooks/useInventory.ts` | Server state: items, loading, error, add/update/remove. |
| `src/client/features/inventory/components/InventoryView.tsx` | CRUD list UI; uses `useInventory`. |
| `src/client/features/inventory/index.ts` | Feature barrel — public surface. |
| `src/shared/types.ts` | **Source of truth** for `Item`/`NewItem`/`ServerFunctions`. Shared client↔server. |
| `src/server/webapp.js` | `doGet()` → serves `index.html`. |
| `src/server/api.js` | Public RPC shim: validate args → delegate to `InventoryService`. |
| `src/server/services/inventoryService.js` | Business logic: rules, orchestration, id/timestamp assignment. |
| `src/server/repositories/itemRepository.js` | Sheets data access (only layer touching `SpreadsheetApp`). Lock + Cache. |
| `src/server/mappers/itemMapper.js` | Pure row↔entity conversion (`fromRow`, `toRow`). |
| `src/server/lib/errors.js` | `AppError` + `ErrorCode` (IIFE, no GAS deps). |
| `src/server/lib/validate.js` | Input validators (`required`, `string`, `nonNegativeNumber`, `uuid`). |
| `src/server/lib/uuid.js` | Wraps `Utilities.getUuid()`. |
| `src/server/lib/datetime.js` | `nowIso()`, `isValidIso()`. |
| `src/server/lib/lock.js` | Wraps `LockService` → `Lock.withLock(fn)`. |
| `src/server/lib/cache.js` | Wraps `CacheService` → `Cache.getOrSet/get/set/remove`. |
| `src/server/contract.ts` | Compile-time only; asserts api matches shared types. NOT pushed. |
| `appsscript.json` | Manifest: V8, webapp ANYONE / USER_DEPLOYING. |
| `.clasp.json` | `{scriptId, rootDir:"dist"}`. Git-ignored; created by `npm run setup`. |
| `scripts/setup.mjs` | One-time: `clasp create --type sheets`, hoist `.clasp.json`. |
| `scripts/copy-server.mjs` | Copy server `.js` + manifest into `dist/`. |
| `scripts/deploy.mjs` | build → copy → `clasp push` (+ `--new-version` → `clasp deploy`). |
| `vite.config.ts` | singlefile build, `emptyOutDir:false`, es2019, inline everything. |
| `tsconfig.client.json` | DOM/React typecheck. `tsconfig.server.json` | GAS typecheck. |

## Commands

| Command | Does |
|---|---|
| `npm install` | deps |
| `npm run login` | `clasp login` (once per machine) |
| `npm run setup` | create the Sheets-bound GAS project (once per project) |
| `npm run dev` | local Vite dev server (uses the **mock** backend) |
| `npm run build` | `tsc` + `vite build` → `dist/index.html` |
| `npm run deploy` | **build + assemble + push** (updates @HEAD code) |
| `npm run deploy:version` | deploy + cut a new immutable web-app version |
| `npm run open` | open the script editor |
| `npm run logs` | tail Stackdriver logs |
| `npm run typecheck` | client typecheck only |

## Deploy flow (mental model)

1. `npm run deploy` runs `scripts/deploy.mjs`:
   build React → `copy-server` flattens server files into `dist/` → `clasp push -f`.
2. The **web app URL is stable** once you create one versioned deployment
   (`deploy:version` once, or Editor ▸ Deploy ▸ New deployment ▸ Web app).
   After that, `npm run deploy` keeps that URL's code current via @HEAD.
3. Front-end changes: just `npm run deploy`. No manual steps.

## Gotchas / decisions

- Server is **plain `.js`** (GAS V8 supports modern JS) → pushed as-is, no
  transpile step. Type-safety on the server is enforced separately via
  `tsconfig.server.json` + `@types/google-apps-script`, not at push time.
- `vite.config.ts` sets `emptyOutDir:false` so the server-copy step and build
  can run in either order without wiping each other. `copy:server` runs after build.
- Mock backend in `server.ts` lets you build UI offline; the `live`/`mock` badge
  in the header shows which is active.
- To change the data model: edit `src/shared/types.ts`, then update `api.js`
  + `sheets.js` (HEADERS array) to match. `npm run typecheck` catches client drift.
- First deployed run auto-creates the `Items` sheet with a header row.
- OAuth: first `/exec` visit prompts for authorization (Sheets scope inferred).

## Developer docs (point humans here, don't duplicate)

Layout (reorganized 2026-05-27): root has only `README.md` + this file; ALL
dev docs live under `docs/`. Sibling links inside docs/ use bare names; links to
source use `../`.

- `README.md` (root) — quick start (install→setup→dev→deploy) + doc-index table.
- `docs/README.md` — doc index.
- `docs/ARCHITECTURE.md` — stack table, GAS constraint table, system diagram, the
  shared/types.ts contract seam, layer layout, non-goals, ADR-001..006, roadmap.
- `docs/DEVELOPMENT.md` — local loop, mock backend, two tsconfigs, conventions.
- `docs/CONTRIBUTING.md` — 6-step add-a-feature recipe + definition-of-done.
- `docs/DATA_MODEL.md` — Items schema, Sheets-as-DB limits + mitigations.
- `docs/DEPLOYMENT.md` — deploy.mjs flow, @HEAD vs versioned, rollback, auth.
- `docs/FRONTEND_GUIDELINES.md` — Atomic Design, feature modules, shadcn/ui,
  Tailwind responsive, Context pattern, custom hooks rules, TS standards, a11y, perf.
- `docs/BACKEND_GUIDELINES.md` — 5-layer architecture (api→service→repo→mapper→lib),
  IIFE module pattern, AppError, Lock/Cache wrappers, GAS-specific hard rules.
- `docs/TROUBLESHOOTING.md` — build/RPC/Sheets/auth/clasp failure modes.
- `docs/DEPLOY_URL.md` — live scriptId, sheet, and /exec URLs (was at root).

Stack is FIXED by user: GAS + Google Sheets backend + React/Vite frontend.
Target architecture **implemented (2026-05-27)**: full 5-layer backend
(api→service→repository→mapper→lib) with LockService + CacheService; client
refactored to features/inventory/ + useInventory hook. Optional TanStack Query
remains a future consideration.

## Status

- ✅ Builds clean (`tsc` + vite), single-file output verified (no external refs).
- ✅ Server contract typecheck passes.
- ✅ **Deployed live** (2026-05-27). scriptId + URLs cached in `DEPLOY_URL.md`.
  - Primary web app = **@HEAD** (`npm run deploy` updates it in place).
  - Backend Sheet auto-creates the `Items` tab on first data write.
- ✅ **5-layer backend refactor complete** (2026-05-27): lib/ + mappers/ + repositories/ + services/ all in place.
- ✅ **Frontend feature-folder refactor complete** (2026-05-27): features/inventory/ + useInventory hook.
- Everyday change → `npm run deploy`. No further manual steps.
