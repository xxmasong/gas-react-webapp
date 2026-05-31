# Troubleshooting

GAS-specific failure modes and fixes. For normal workflow see
[DEVELOPMENT.md](DEVELOPMENT.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

## Build / bundle

**`dist/index.html not found` during deploy.**
The server-copy step ran before the Vite build. Run `npm run build` first, or just
`npm run deploy` (which orders them correctly).

**App loads but assets 404 / blank page in GAS.**
GAS can only serve one self-contained file. Confirm the build inlined everything:
`dist/index.html` should contain no external `<script src>` / `<link href>` to
local files. If not, check `vite-plugin-singlefile` is active in `vite.config.ts`.

## RPC (`google.script.run`)

**`google is not defined` / calls do nothing in dev.**
Expected. There is no GAS host during `npm run dev`; `server.ts` falls back to the
mock. The header badge should read `local mock`. To test real RPC, `npm run deploy`.

**A new server function isn't callable from the client.**
- It must be a **top-level named function** in a pushed `.js` file (not nested, not
  arrow-assigned, not in `contract.ts` which isn't pushed).
- Re-deploy after adding it — the running deployment uses pushed code.
- Add the client wrapper + mock branch in `src/client/lib/server.ts`, and the
  signature in `ServerFunctions`.

**RPC returns `undefined` or throws "serialization" errors.**
Arguments/returns must be JSON-serializable. Don't pass Dates, functions, or class
instances across the boundary — use ISO strings and plain objects.

## Sheets / data

**`Item not found` on update/delete.**
`findRowIndexById` (in `repositories/itemRepository.js`) resolves a row by scanning the
id column. The id must match exactly (string compare). If a row was deleted
concurrently, the lookup fails — see locking.

**Lost or overwritten writes under multiple users.**
Read-then-write race: two calls compute row numbers before either writes. Wrap
mutations in `LockService.getScriptLock()`. See [DATA_MODEL.md](DATA_MODEL.md).

**Slow list/reads.**
You're likely doing per-cell or repeated `getRange` calls. Batch with a single
`getValues()`. For hot reads, cache with `CacheService`.

## Auth / access

**`/exec` redirects to Google sign-in.**
Expected for anonymous visitors given the manifest's `access`/`executeAs`. Sign in;
the first run prompts to authorize the Sheets scope.

**Authorization prompt loops or "needs permission" errors.**
The required scope changed (e.g. you added a new Google service). Re-open the
editor (`npm run open`), run any function once to re-trigger the consent screen, and
re-deploy.

## clasp / deploy

**`.clasp.json not found`.**
Run `npm run login` then `npm run setup` to create the project and write
`.clasp.json` (git-ignored).

**Push succeeds but the live app is unchanged.**
The deployment may point at a fixed version, not @HEAD. Check Deploy ▸ Manage
deployments in the editor; the primary should serve @HEAD. See [DEPLOYMENT.md](DEPLOYMENT.md).

**Diagnosing server errors.**
`npm run logs` tails Stackdriver. Add `console.log` in the `api.js` shim to trace
arguments and timing.
