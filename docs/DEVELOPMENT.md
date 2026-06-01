# Development

How to work on the app locally. For first-time setup see [README.md](../README.md);
for architecture see [ARCHITECTURE.md](ARCHITECTURE.md); to add a feature see
[CONTRIBUTING.md](CONTRIBUTING.md).

---

## 1. The local loop

```bash
npm run dev        # Vite dev server + HMR at http://localhost:5173
npm run typecheck  # tsc — run before every deploy
npm run build      # production bundle → dist/index.html
npm run deploy     # build + push to GAS
npm run logs       # tail Stackdriver server logs
npm run open       # open the Apps Script editor
```

The dev server **cannot reach Apps Script** (there is no GAS host in the browser).
It runs against an **in-memory mock backend** defined in
[../src/client/lib/server.ts](../src/client/lib/server.ts). The app header shows:

- `local mock` — you are on the mock (during `npm run dev`)
- `Sheets backend` — you are inside the real deployed app

Build the entire UI offline, then deploy to test against real Sheets.

---

## 2. The mock backend

`server.ts` exposes a single `server` object that branches on whether it is running
inside the GAS iframe:

- **In GAS:** calls the real `gas-client` proxy → your `api.js` functions
- **In dev:** calls `createMock()`, an in-memory implementation that mirrors server behaviour

### Mock parity rule

**When you add or change a server function, update the mock in the same commit.**
Mock parity is part of the definition of done — otherwise local dev diverges from prod.

This applies to every new entity introduced in the reconciliation build:

| New server function | Required mock behaviour |
|---|---|
| `createReconciliationSession` | Returns a session in `draft` status with unique id |
| `submitCashierCount` | Validates expected ending formula; locks the cashier count |
| `runComparison` | Classifies each SKU per the 9-case matrix; returns `ReconciliationResult[]` |
| `approveVariance` | Enforces self-approval restriction; creates approval record |
| `postAdjustments` | Creates `StockMovement` entries; sets session to `posted` |
| … (all new functions) | Mirror the same input validation and output shape as the real service |

The mock does not need to persist to disk — in-memory arrays reset on page reload,
which is fine for local development and UAT of individual flows.

---

## 3. Typechecking

```bash
npm run typecheck   # client + shared contract (tsc, no emit)
```

Two TS projects:

- `tsconfig.client.json` — DOM/React code in `src/client/` + `src/shared/`
- `tsconfig.server.json` — GAS code; uses `@types/google-apps-script`. Server `.js`
  is plain JS but is typechecked against `src/server/contract.ts`, which asserts
  `api.js` implements `ServerFunctions`. **This file is never pushed.**

Run typecheck before every deploy — it catches client/server contract drift.

---

## 4. Conventions

### Must follow (non-negotiable)

- **Never call `google.script.run` from a component.** Always go through `server.ts`.
- **One source of truth for types:** `src/shared/types.ts`. Edit it first.
- **Server functions are top-level named globals** (GAS exposes globals to RPC). They take and return only JSON-serializable values.
- **DAL isolation:** only `src/server/repositories/` touch `SpreadsheetApp`.
- **Keep the bundle inlinable:** no runtime CDN loads or separate worker files — `vite-plugin-singlefile` must inline everything into one HTML file.
- **Prefer `type` over `interface`** for all TypeScript declarations throughout the codebase (project convention).
- **No direct stock quantity writes.** `bulkUpdateStock` and `saveAndVerifyStock` are deprecated. All stock changes go through `postingService` → `StockMovements`.
- **Every write acquires the script lock.** Wrap `LockService.getScriptLock()` around any Sheets mutation.
- **Every approve/post/reopen action is audited.** Call `auditService.log()` — never skip.

### Routing

- Routes are hash-based (`/#/path`) — required by GAS iframe constraint.
- Route paths are constants in `src/client/routes/paths.ts`.
- Route guards (auth check, role check) live in `src/client/routes/guards.tsx`.
- Never put navigation logic inside feature components.

### State

- Server data belongs in feature hooks (`useXxx`), not in Context.
- Form state belongs in local hooks (`useXxxForm`), not in Context.
- Auth state belongs in `AuthContext` (`src/client/providers/AuthProvider.tsx`).

---

## 5. Feature development workflow

1. **Contract first** — add type + `ServerFunctions` entry to `src/shared/types.ts`
2. **Backend** — repository → mapper → service → api.js shim
3. **Mock** — update `createMock()` in `server.ts`
4. **Frontend** — hook → components → route
5. **Typecheck** — `npm run typecheck` must pass
6. **Deploy** — `npm run deploy`, then smoke-test in the live GAS iframe

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full recipe.

---

## 6. Useful commands

| Command | Does |
|---|---|
| `npm run dev` | Local dev server (mock backend) |
| `npm run build` | `tsc` + `vite build` → `dist/index.html` |
| `npm run typecheck` | Type-check client + contract |
| `npm run deploy` | Build + assemble + push (see [OPERATIONS.md](OPERATIONS.md)) |
| `npm run deploy:version` | Build + push + cut a new numbered deployment |
| `npm run open` | Open the Apps Script editor |
| `npm run logs` | Tail Stackdriver logs |
| `npm run reseed` | Re-run the inventory seed migration (dev/staging only) |
