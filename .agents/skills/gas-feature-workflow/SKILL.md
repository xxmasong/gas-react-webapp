---
name: gas-feature-workflow
description: Add or modify GAS Inventory System features, entities, routes, hooks, server services, repositories, mappers, validators, or RPC functions. Use when Codex is asked to add a feature, add a new RPC, change ServerFunctions, edit api.js, change the client server bridge, or implement end-to-end app behavior in this Google Apps Script React project.
---

# GAS Feature Workflow

Use this skill for feature and RPC implementation in this repo.

## Source Order

1. Read `AGENTS.md` first for always-on constraints.
2. For a full entity or page, read `.claude/skills/add-feature/SKILL.md`.
3. For one new RPC on an existing service, read `.claude/skills/new-rpc/SKILL.md`.
4. For server edits, read `.claude/rules/server.md`.
5. For client edits, read `.claude/rules/client.md`.
6. For contract bridge edits, read `.claude/rules/contract.md`.

Treat those `.claude` files as canonical project procedure files even when working in Codex. They are shared process documentation, not Claude-only truth.

## Required Workflow

Start with `src/shared/types.ts` for every new entity, input type, return shape, or RPC.

Follow the backend layer order exactly:

```text
api.js -> service -> repository -> mapper
```

Keep `api.js` as top-level named function declarations only. Do not use server-side `import` or `export` in `.js` files.

Put every Sheets write inside `Lock.withLock(fn)`, including auth/session writes.

For every new or changed RPC, update all four surfaces in the same change:

```text
src/shared/types.ts
src/server/api.js
src/client/lib/server.ts
src/client/lib/serverMock.ts
```

In `server.ts`, add one entry to the exported `server` object. In `serverMock.ts`, add one synchronous `createMock()` entry whose first argument is `token` except for `login`.

## Verification

Run this before handing work back:

```bash
npm run typecheck:all
```

If the contract changed, also inspect semantic mock parity because `verify:contract` checks names and TypeScript checks types, but neither proves the mock matches real business behavior.
