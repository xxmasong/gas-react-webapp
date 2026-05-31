# Deployment

How code gets from your machine to the live Apps Script web app. Live IDs and URLs
are in [DEPLOY_URL.md](DEPLOY_URL.md).

## One-time setup

```bash
npm install
npm run login            # clasp auth with your Google account (once per machine)
npm run setup            # creates the Sheets-bound GAS project, writes .clasp.json
npm run deploy:version   # build, push, and cut the first versioned web-app deployment
npm run open             # editor → Deploy ▸ Manage deployments → copy the /exec URL
```

Enable the Apps Script API once at <https://script.google.com/home/usersettings>.

## Everyday deploy

```bash
npm run deploy           # build + assemble + push to @HEAD (updates the live URL in place)
```

What [../scripts/deploy.mjs](../scripts/deploy.mjs) does:

1. `npm run build` — `tsc` + `vite build` → `dist/index.html` (everything inlined).
2. `npm run copy:server` — copies server `.js` (preserving `lib/ mappers/ repositories/
   services/` subfolders) + `appsscript.json` into `dist/`
   (see [../scripts/copy-server.mjs](../scripts/copy-server.mjs)). `.ts` contract
   files are skipped.
3. `clasp push -f` — uploads `dist/` to the Apps Script project.

The primary deployment serves **@HEAD**, so the existing `/exec` URL reflects the
latest push — no manual step to repoint it.

## Versioned snapshots

```bash
npm run deploy:version   # everything above + `clasp deploy` → a new immutable version
```

Use this when you want a frozen release you can point to or roll back to. Day-to-day
front-end changes do **not** need it — `npm run deploy` is enough.

## How the build is assembled

GAS needs the served HTML, server scripts, and manifest under one `rootDir` (`dist/`).
`copy-server.mjs` **preserves the `src/server/` subfolders** (GAS loads `.js` files
recursively), so the layout is:

```
dist/
  index.html                       ← Vite single-file bundle (the React app doGet() serves)
  api.js                           ← RPC surface
  webapp.js                        ← doGet()
  appsscript.json                  ← manifest
  lib/{validate,errors,lock,cache,uuid,datetime}.js
  mappers/itemMapper.js
  repositories/itemRepository.js
  services/inventoryService.js
```

(There is no `sheets.js`; `contract.ts` is skipped — it's never pushed.)
`vite.config.ts` sets `emptyOutDir: false` so the build and the server-copy step
don't wipe each other regardless of order.

## Rollback

- **To a previous version:** in the editor (`npm run open`) → Deploy ▸ Manage
  deployments, point the web-app deployment at an earlier version, or redeploy a
  known-good snapshot created via `deploy:version`.
- **Code-level:** revert the commit, then `npm run deploy` to push @HEAD back.

## Auth model

The manifest ([../appsscript.json](../appsscript.json)) sets `access` and
`executeAs`. Anonymous visitors hitting `/exec` are redirected to Google sign-in —
that is the expected auth gate, not an error. The first authenticated run prompts
to authorize the Sheets scope.

## Observability

```bash
npm run logs             # tail Stackdriver logs (exceptionLogging: STACKDRIVER)
```
