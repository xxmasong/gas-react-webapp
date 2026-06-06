---
name: gas-deploy-gate
description: Run or prepare the GAS Inventory System pre-deploy gate. Use before Apps Script deployment, release, clasp push, deploy:version, production smoke checks, or when Codex must verify typecheck, contract parity, mock parity, build output, and versioned deployment safety.
---

# GAS Deploy Gate

Use this skill before any deploy or release-like operation.

## Source Order

1. Read `AGENTS.md`.
2. Read `.claude/skills/deploy-check/SKILL.md` for the full gate.
3. Read `.claude/skills/verify-contract/SKILL.md` if contract files changed.

## Gate

Run the deterministic checks first:

```bash
npm run typecheck:all
npm run build
```

If the user explicitly asks to deploy, use only:

```bash
npm run deploy:version
```

Do not run `npm run deploy`, `npm run push`, or bare `clasp push` for release work. The deploy script blocks HEAD-only deploys unless `DEPLOY_ALLOW_HEAD=1` is intentionally set.

## Manual Checks

Before deploying, confirm:

- Every changed RPC is present in `types.ts`, `api.js`, `server.ts`, and `serverMock.ts`.
- Mock behavior mirrors real service output shape.
- New sheets are in `src/server/config.js` with sheet name, cache key, and TTL.
- New pages use route constants and route-level role gates.
- `CLAUDE.md` and `AGENTS.md` remain accurate when architecture or process changes.

After deploy, check logs with:

```bash
npm run logs
```
