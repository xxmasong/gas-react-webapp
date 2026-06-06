---
name: gas-contract-audit
description: Audit, diagnose, and fix RPC contract drift in the GAS Inventory System. Use when api.js, src/shared/types.ts, src/client/lib/server.ts, src/client/lib/serverMock.ts, ServerFunctions, createMock, the exported server object, or google.script.run bridge parity may be out of sync.
---

# GAS Contract Audit

Use this skill whenever the RPC contract may have drifted.

## Source Order

1. Read `AGENTS.md`.
2. Read `.claude/skills/verify-contract/SKILL.md` for the full audit procedure.
3. Read `.claude/rules/contract.md` before editing any contract surface.

## Contract Surfaces

All RPC names must exist on all four surfaces:

```text
src/shared/types.ts              ServerFunctions
src/server/api.js                top-level named GAS functions
src/client/lib/server.ts         exported server object
src/client/lib/serverMock.ts     createMock() return object
```

`login` is unauthenticated. Every other raw server function takes `token` first. The public client `server` object injects that token with `authed(...)`.

## Deterministic Check

Run:

```bash
npm run verify:contract
```

Fix every missing surface it reports. Then run:

```bash
npm run typecheck:all
```

## Semantic Mock Check

After the deterministic check passes, inspect `serverMock.ts` manually for behavior parity:

- Inventory mocks recompute `qtyTotal`, `kyteMatch`, and `costTotal`.
- Created/updated entities set `updatedAt`.
- Role checks match the real service.
- Validation and not-found behavior are close enough for local UI development.
- No mock-only fields leak into shared types.
