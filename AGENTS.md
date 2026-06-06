# AGENTS.md — Sub-agent context

Compressed context for Claude sub-agents. Full rules are in CLAUDE.md.

## What this project is

Google Apps Script web app. React 18 + TypeScript frontend (Vite, single inlined HTML bundle) talking to a Google Sheets backend via `google.script.run`. No REST, no fetch, no Node server.

## Non-negotiable rules

- `src/shared/types.ts` is the single source of truth. Edit it before any server or client code.
- Layer order: `api.js → service → repository → mapper`. Never skip or reverse.
- `api.js` functions must be **top-level named function declarations** — GAS V8 exposes globals, not arrow functions or exports.
- No `import`/`export` in any server `.js` file — use IIFEs.
- Every Sheets write inside `Lock.withLock(fn)` — **including** auth/session writes in `userRepository.js`.
- `src/client/lib/server.ts` is the **only** file that calls `google.script.run`.
- All server calls from feature **hooks**, never from components.
- `type` over `interface` everywhere. No `any`.
- When `api.js` changes, the client bridge changes in the **same commit**: an entry in the `server` object (`src/client/lib/server.ts`) **and** an entry in `createMock()` (`src/client/lib/serverMock.ts`). The mock entry takes `token` as its first arg and returns synchronously.
- Always `npm run deploy:version` — never HEAD-only deploy. `scripts/deploy.mjs` blocks HEAD deploys unless `DEPLOY_ALLOW_HEAD=1`.
- `npm run typecheck:all` must pass before deploying — it runs both tsc projects **and** `node scripts/verify-contract.mjs` (name-set parity across the four contract surfaces).

## Key files

| File | Role |
|---|---|
| `src/shared/types.ts` | Contract — entity types + ServerFunctions (single source of truth) |
| `src/client/lib/server.ts` | Real RPC bridge — the exported `server` object (token injected) |
| `src/client/lib/serverMock.ts` | Mock bridge — `createMock()`, used during `vite dev` |
| `src/server/api.js` | 26 top-level RPC functions |
| `src/server/config.js` | Sheet names, cache TTLs, roles, stores |

## Layer templates (copy these)

**api.js function:**
```js
function doThing(token, input) {
  AuthService.requireRole(token, _getRole().SUPERVISOR);
  validate.thing(input);
  return ThingService.doThing(input);
}
```

**Repository write:**
```js
var insert = (entity) => Lock.withLock(() => {
  getSheet().appendRow(Mapper.toRow(entity));
  Cache.remove(CACHE_KEY);
  return entity;
});
```

**Service add:**
```js
var add = (input) => {
  var entity = { ...input, id: Uuid.generate(), updatedAt: DateTime.nowIso() };
  return Repository.insert(entity);
};
```

**Feature hook:**
```ts
export function useThings() {
  const [items, setItems] = useState<Thing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await server.getThings()); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { items, loading, error, reload: load };
}
```

## Procedures & deterministic gates (tool-agnostic)

Guided procedures live as Markdown in `.claude/skills/<name>/SKILL.md`. They are the
single source of truth for each workflow — read the relevant one before doing that task,
whether or not your harness auto-loads it:

| Task | Procedure file | Deterministic command(s) |
|---|---|---|
| Add a full new entity end-to-end | `.claude/skills/add-feature/SKILL.md` | `npm run typecheck:all` |
| Add one RPC to an existing service | `.claude/skills/new-rpc/SKILL.md` | `npm run typecheck:all` |
| Audit contract drift | `.claude/skills/verify-contract/SKILL.md` | `npm run verify:contract` |
| Pre-deploy gate | `.claude/skills/deploy-check/SKILL.md` | `npm run typecheck:all` → `npm run build` → `npm run deploy:version` |

Copy-paste code templates by layer live in `.claude/rules/*.md`
(`server.md` for `src/server/**`, `client.md` for `src/client/**`, `contract.md` for the
RPC-contract files). Claude Code auto-loads these on matching edits; under other harnesses,
open the matching rule file by hand.

**Enforcement that does not depend on any harness reading prose:**
- `npm run verify:contract` — fails if any RPC name is missing from any of the four contract surfaces.
- `npm run typecheck:all` — runs both tsc projects **and** `verify:contract`; must pass before deploy.
- `scripts/deploy.mjs` — refuses a HEAD-only deploy unless `DEPLOY_ALLOW_HEAD=1` (releases are always versioned).

> Claude Code adds extra PreToolUse guards in `.claude/hooks/*.cjs` (block HEAD deploy / destructive
> git, gate deploy on `typecheck:all`). Harnesses that don't read `.claude/hooks` still get the
> equivalent protection from the script-level gates above.
