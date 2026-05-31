# Project layout — canonical document tree & authoritative configs

This is the **reproduction spec**. If you are an AI or a developer recreating this
project from scratch, this file plus [BUSINESS_LOGIC.md](BUSINESS_LOGIC.md) define
the exact file tree, the role of every file, and the literal contents of the
configuration files. Build the tree in the order in §6. For *why* the design looks
this way, read [ARCHITECTURE.md](ARCHITECTURE.md).

> Rule of authority: the **config files below are the source of truth** for tooling.
> Reproduce them verbatim. Prose elsewhere explains intent; these listings define
> behavior. Versions are pinned by `package.json` / `package-lock.json`.

---

## 1. The complete document tree

```
gas-react-webapp/
├── README.md                      # quick start + doc index
├── KNOWLEDGE.md                   # AI context cache (NOT a developer doc)
├── package.json                   # deps + scripts (see §3.1)
├── package-lock.json              # lockfile — pins exact versions
├── index.html                     # Vite dev entry (built → dist/index.html)
├── vite.config.ts                 # single-file build config (see §3.2)
├── tsconfig.client.json           # client/shared typecheck (see §3.3)
├── tsconfig.server.json           # server (GAS) typecheck (see §3.4)
├── appsscript.json                # GAS manifest (see §3.5)
├── .clasp.json.example            # template; real .clasp.json is git-ignored
├── .claspignore                   # clasp push excludes (relative to dist/)
├── .gitignore
├── docs/                          # all developer docs (this folder)
│   ├── README.md                  # doc index
│   ├── ARCHITECTURE.md
│   ├── PROJECT_LAYOUT.md          # this file
│   ├── BUSINESS_LOGIC.md          # exact business + modular logic
│   ├── DEVELOPMENT.md
│   ├── CONTRIBUTING.md
│   ├── DATA_MODEL.md
│   ├── DEPLOYMENT.md
│   ├── FRONTEND_GUIDELINES.md
│   ├── BACKEND_GUIDELINES.md
│   ├── TROUBLESHOOTING.md
│   └── DEPLOY_URL.md              # live IDs/URLs (environment-specific)
├── scripts/                       # Node build/deploy helpers (ESM .mjs)
│   ├── setup.mjs                  # one-time: clasp create + hoist .clasp.json
│   ├── copy-server.mjs            # assemble dist/ (server .js + manifest)
│   └── deploy.mjs                 # build → copy → clasp push (+ optional version)
└── src/
    ├── shared/
    │   └── types.ts               # THE contract: Item, NewItem, ServerFunctions
    ├── client/                    # React + Vite frontend (TypeScript)
    │   ├── main.tsx               # React mount only
    │   ├── App.tsx                # shell: layout + live/mock badge
    │   ├── server.ts              # 2-line re-export shim → lib/server.ts
    │   ├── styles.css             # hand-written CSS (no Tailwind/shadcn)
    │   ├── vite-env.d.ts          # `google` global shim + vite client types
    │   ├── lib/
    │   │   └── server.ts          # CANONICAL RPC bridge: real gas-client | mock
    │   └── features/
    │       └── inventory/
    │           ├── index.ts       # barrel — exports InventoryView
    │           ├── components/
    │           │   └── InventoryView.tsx   # CRUD list UI
    │           └── hooks/
    │               └── useInventory.ts     # server state + CRUD actions
    └── server/                    # Apps Script backend (plain JS, GAS V8)
        ├── webapp.js              # doGet() — serves index.html
        ├── api.js                 # RPC surface (top-level globals)
        ├── contract.ts            # compile-time type check; NOT pushed
        ├── services/
        │   └── inventoryService.js   # business logic
        ├── repositories/
        │   └── itemRepository.js     # ONLY file touching SpreadsheetApp
        ├── mappers/
        │   └── itemMapper.js         # pure row ↔ entity
        └── lib/                   # GAS-free-ish stateless helpers (IIFE globals)
            ├── validate.js
            ├── errors.js
            ├── lock.js
            ├── cache.js
            ├── uuid.js
            └── datetime.js
```

There is **no `src/server/sheets.js`** and **no `src/client/app/` or
`src/client/shared/components/` tree** — older drafts referenced those; they do not
exist. The backend data layer is `repositories/itemRepository.js` + `mappers/itemMapper.js`.

---

## 2. Role of every source file (one line each)

### Shared
| File | Role |
|---|---|
| `src/shared/types.ts` | Single source of truth for `Item`, `NewItem`, `ServerFunctions`. Both sides compile against it. |

### Client (`src/client/`)
| File | Role |
|---|---|
| `main.tsx` | Mounts `<App/>` into `#root` under `StrictMode`. No logic. |
| `App.tsx` | Shell: `<header>` with title + `live`/`mock` badge; renders `<InventoryView/>`. |
| `lib/server.ts` | **The only place that touches `google.script.run`.** Real `gas-client` inside GAS; in-memory `createMock()` during dev. Exports `server` + `runningInGas`. |
| `server.ts` | Re-export shim: `export { server, runningInGas } from './lib/server'`. |
| `features/inventory/index.ts` | Barrel: `export { InventoryView }`. The feature's only public surface. |
| `features/inventory/components/InventoryView.tsx` | The page: add form + item list with +/- quantity and delete. Calls the hook, never `server.*` directly. |
| `features/inventory/hooks/useInventory.ts` | Server state: `items/loading/error` + `add/update/remove/reload`. Wraps `server.*`. |
| `styles.css` | All styling (GitHub-ish palette). Plain CSS. |
| `vite-env.d.ts` | Loose `declare const google` so feature-detection typechecks without DOM-incompatible GAS types. |

### Server (`src/server/`) — load order matters (see §5)
| File | Role |
|---|---|
| `webapp.js` | `doGet()` serves `index.html` with `XFrameOptionsMode.ALLOWALL`; `include()` helper. |
| `api.js` | Top-level globals `getItems/addItem/updateItem/deleteItem`. Validate → delegate to `InventoryService` → return. |
| `services/inventoryService.js` | `InventoryService` IIFE: business rules, id/timestamp assignment, not-found checks. |
| `repositories/itemRepository.js` | `ItemRepository` IIFE: the **only** `SpreadsheetApp` user. Sheet auto-create, Lock on writes, Cache on reads. |
| `mappers/itemMapper.js` | `ItemMapper` IIFE: pure `fromRow`/`toRow`. |
| `lib/validate.js` | `validate` IIFE: `required/string/nonNegativeNumber/uuid`. |
| `lib/errors.js` | `ErrorCode` map + `AppError` factory (`validation/notFound/...`). |
| `lib/lock.js` | `Lock.withLock(fn)` → `LockService.getScriptLock()`, `waitLock(10000)`. |
| `lib/cache.js` | `Cache.getOrSet/get/set/remove` → `CacheService.getScriptCache()`, default TTL 300s. |
| `lib/uuid.js` | `Uuid.generate()` → `Utilities.getUuid()`. |
| `lib/datetime.js` | `DateTime.nowIso()` / `isValidIso()`. |
| `contract.ts` | Compile-time only; imports `ServerFunctions`. **Never pushed** (`copy-server.mjs` skips `.ts`). |

---

## 3. Authoritative configuration files (reproduce verbatim)

### 3.1 `package.json`
```json
{
  "name": "gas-react-webapp",
  "version": "1.0.0",
  "description": "Google Apps Script web app with a React (Vite) frontend and Google Sheets backend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.client.json && vite build",
    "copy:server": "node scripts/copy-server.mjs",
    "push": "clasp push -f",
    "deploy": "node scripts/deploy.mjs",
    "deploy:version": "node scripts/deploy.mjs --new-version",
    "login": "clasp login",
    "setup": "node scripts/setup.mjs",
    "open": "clasp open-script",
    "logs": "clasp tail-logs",
    "typecheck": "tsc -p tsconfig.client.json --noEmit"
  },
  "dependencies": {
    "gas-client": "^1.2.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@google/clasp": "^2.4.2",
    "@types/google-apps-script": "^1.0.83",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react-swc": "^3.7.2",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vite-plugin-singlefile": "^2.0.3"
  }
}
```

### 3.2 `vite.config.ts`
The single-file constraint lives here. Every option below is load-bearing.
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,           // server-copy step must not be wiped by the build
    target: 'es2019',
    assetsInlineLimit: 100000000, // inline everything
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    reportCompressedSize: false,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
```

### 3.3 `tsconfig.client.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@shared/*": ["src/shared/*"] }
  },
  "include": ["src/client", "src/shared"]
}
```

### 3.4 `tsconfig.server.json`
```json
{
  "compilerOptions": {
    "target": "ES2019",
    "lib": ["ES2019"],
    "module": "None",
    "types": ["google-apps-script"],
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@shared/*": ["src/shared/*"] }
  },
  "include": ["src/server", "src/shared"]
}
```

### 3.5 `appsscript.json`
```json
{
  "timeZone": "America/New_York",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE"
  }
}
```

### 3.6 `index.html` (Vite dev entry)
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GAS React Web App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
```

### 3.7 `.gitignore`, `.claspignore`, `.clasp.json.example`
```gitignore
# .gitignore
node_modules/
dist/
.clasp.json        # contains your scriptId
.clasprc.json      # clasp auth credentials
```
```gitignore
# .claspignore (relative to rootDir = dist/). We only generate wanted files, so:
**/*.map
```
```json
// .clasp.json.example  (real .clasp.json is written by `npm run setup`)
{
  "scriptId": "<filled-in-by-npm-run-setup>",
  "rootDir": "dist"
}
```

---

## 4. The `@shared` path alias (load-bearing, easy to miss)

Both the client and server import shared types as `@shared/types`, never by relative
path. The alias is wired in **three** places and all must agree:

- `vite.config.ts` → `resolve.alias['@shared'] = src/shared`
- `tsconfig.client.json` → `paths['@shared/*'] = ['src/shared/*']`
- `tsconfig.server.json` → same `paths` entry

Example: `import type { Item, NewItem, ServerFunctions } from '@shared/types';`

---

## 5. GAS module pattern & load order

- The server is **plain JS pushed as-is** (GAS V8, no bundler). There is no
  `import`/`export` on the server — files share one global scope.
- Each server module is an **IIFE assigned to a `var` global**:
  `var ItemRepository = (function () { ... return { ... }; })();`. `api.js` exposes
  **top-level function declarations** (so `google.script.run` can call them).
- GAS loads all `.js` files; order is not guaranteed at parse time, but because every
  module is an IIFE evaluated immediately and only *referenced* at call time, the
  cross-references (`api → InventoryService → ItemRepository → ItemMapper → lib`)
  resolve fine at runtime.
- `copy-server.mjs` mirrors the `src/server/` subfolders into `dist/` (it does **not**
  flatten): `dist/{lib,mappers,repositories,services}/*.js` plus flat `dist/api.js`,
  `dist/webapp.js`, and `dist/appsscript.json`. `contract.ts` is skipped.

Resulting `dist/` after `npm run build && npm run copy:server`:
```
dist/
├── index.html              # Vite single-file bundle (everything inlined)
├── api.js
├── webapp.js
├── appsscript.json
├── lib/{validate,errors,lock,cache,uuid,datetime}.js
├── mappers/itemMapper.js
├── repositories/itemRepository.js
└── services/inventoryService.js
```

---

## 6. Reproduction order (build the tree in this sequence)

1. `npm init` with the **exact** `package.json` in §3.1, then `npm install`.
2. Add configs: `vite.config.ts`, `tsconfig.client.json`, `tsconfig.server.json`,
   `appsscript.json`, `index.html`, `.gitignore`, `.claspignore`, `.clasp.json.example` (§3).
3. Create the **contract** first: `src/shared/types.ts`
   (see [BUSINESS_LOGIC.md §1](BUSINESS_LOGIC.md#1-the-contract)).
4. Backend bottom-up: `lib/*` → `mappers/itemMapper.js` → `repositories/itemRepository.js`
   → `services/inventoryService.js` → `api.js` → `webapp.js` → `contract.ts`
   (exact logic in [BUSINESS_LOGIC.md](BUSINESS_LOGIC.md)).
5. Client: `lib/server.ts` (+ `server.ts` shim) → `features/inventory/*`
   → `App.tsx` → `main.tsx` → `styles.css` → `vite-env.d.ts`.
6. Build helpers: `scripts/{setup,copy-server,deploy}.mjs` (behavior in §7).
7. Verify: `npm run typecheck` and `npm run build` must pass with zero errors, and
   `dist/index.html` must contain **no external `<script src>`/`<link href>`**.

---

## 7. `scripts/*.mjs` behavior contract

These are ESM Node scripts (`"type": "module"`). Reproduce this behavior exactly.

**`setup.mjs`** (one-time project bootstrap; requires `npm run login` first):
- Abort if `.clasp.json` already exists at root.
- `mkdir -p dist`, then run `npx clasp create --type sheets --title "GAS React Web App" --rootDir dist`.
- clasp writes `.clasp.json` into `dist/`; move it to repo root and force `rootDir: "dist"`.
- Remove any stray `dist/appsscript.json` clasp created. Print next-step hints.

**`copy-server.mjs`** (assemble `dist/`):
- Recursively copy `src/server/**/*.js` into `dist/`, **preserving subdirectories**
  (root files flat; `lib/`, `mappers/`, `repositories/`, `services/` mirrored). Skip `.ts`.
- Copy root `appsscript.json` → `dist/appsscript.json`.
- If `dist/index.html` is missing, warn and exit non-zero (build must run first).

**`deploy.mjs`** (`--new-version` optional):
- Abort if `.clasp.json` missing (tell user to `login` + `setup`).
- `npm run build` → `npm run copy:server` → `npx clasp push -f`.
- If `--new-version`: `npx clasp deploy --description "deploy <YYYY-MM-DD HH:MM>"`.

---

## 8. What is intentionally absent

No tests, no CI, no linter, no pre-commit hooks, no router, no Tailwind/shadcn, no
state library. `npm run typecheck` is the only automated gate. Any doc describing
those (e.g. parts of [FRONTEND_GUIDELINES.md](FRONTEND_GUIDELINES.md)) is **target
state**, explicitly labeled as such — do not reproduce it as current code.
