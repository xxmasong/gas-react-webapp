# Development

How to work on the app locally. For first-time setup see the root
[README.md](../README.md); for the architecture see [ARCHITECTURE.md](ARCHITECTURE.md).

## The local loop

```bash
npm run dev        # Vite dev server + HMR at http://localhost:5173
```

The dev server **cannot reach Apps Script** (there is no GAS host in the browser).
So it runs against an in-memory **mock backend** defined in
[../src/client/server.ts](../src/client/server.ts). The app header shows a badge:

- `local mock` — you are on the mock (during `npm run dev`).
- `Sheets backend` — you are inside the real deployed app.

This lets you build the entire UI offline, then deploy to test against real Sheets.

## The mock backend (important)

`server.ts` exposes a single `server` object. It branches on whether it is running
inside the GAS iframe:

- **In GAS:** calls the real `gas-client` proxy → your `api.js` functions.
- **In dev:** calls `createMock()`, an in-memory implementation that mirrors the
  server behaviour.

**Rule:** when you add or change a server function, update the mock in the same
commit. Mock parity is part of "done" — otherwise local dev diverges from prod.

## Typechecking

```bash
npm run typecheck   # client + shared contract (tsc, no emit)
```

There are two TS projects:

- `tsconfig.client.json` — DOM/React code in `src/client` + `src/shared`.
- `tsconfig.server.json` — GAS code; uses `@types/google-apps-script`. Server `.js`
  is plain JS but is typechecked against `src/server/contract.ts`, which asserts
  `api.js` implements `ServerFunctions`. This file is **never pushed**.

Run typecheck before every deploy — it catches client/server contract drift.

## Conventions

- **Never call `google.script.run` from a component.** Go through `server.ts`.
- **One source of truth for types:** `src/shared/types.ts`. Edit it first.
- **Server functions are top-level named globals** (GAS exposes globals to RPC).
  They take and return only JSON-serializable values.
- **DAL isolation:** only `src/server/sheets.js` touches `SpreadsheetApp`.
- **Keep the bundle inlinable:** no runtime CDN loads or separate worker files —
  `vite-plugin-singlefile` must inline everything into one HTML file.

## Useful commands

| Command | Does |
|---|---|
| `npm run dev` | Local dev server (mock backend). |
| `npm run build` | `tsc` + `vite build` → `dist/index.html`. |
| `npm run typecheck` | Type-check client + contract. |
| `npm run deploy` | Build + assemble + push (see [DEPLOYMENT.md](DEPLOYMENT.md)). |
| `npm run open` | Open the Apps Script editor. |
| `npm run logs` | Tail Stackdriver logs. |
