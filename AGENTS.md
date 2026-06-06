# AGENTS.md — Sub-agent context

Compressed context for Claude sub-agents. Full rules are in CLAUDE.md.

## What this project is

Google Apps Script web app. React 18 + TypeScript frontend (Vite, single inlined HTML bundle) talking to a Google Sheets backend via `google.script.run`. No REST, no fetch, no Node server.

## Non-negotiable rules

- `src/shared/types.ts` is the single source of truth. Edit it before any server or client code.
- Layer order: `api.js → service → repository → mapper`. Never skip or reverse.
- `api.js` functions must be **top-level named function declarations** — GAS V8 exposes globals, not arrow functions or exports.
- No `import`/`export` in any server `.js` file — use IIFEs.
- Every Sheets write inside `Lock.withLock(fn)`.
- `src/client/lib/server.ts` is the **only** file that calls `google.script.run`.
- All server calls from feature **hooks**, never from components.
- `type` over `interface` everywhere. No `any`.
- When `api.js` changes, `server.ts` real call + mock change in the **same commit**.
- Always `npm run deploy:version` — never HEAD-only deploy.
- `npm run typecheck:all` must pass before deploying.

## Key files

| File | Role |
|---|---|
| `src/shared/types.ts` | Contract — entity types + ServerFunctions |
| `src/client/lib/server.ts` | RPC bridge — real GAS call vs in-memory mock |
| `src/server/api.js` | 23 top-level RPC functions |
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

## Slash commands available

- `/project:add-feature` — full guided feature workflow
- `/project:new-rpc` — add one RPC to existing service
- `/project:deploy-check` — pre-deploy gate
- `/project:verify-contract` — audit api.js ↔ types.ts ↔ server.ts sync
