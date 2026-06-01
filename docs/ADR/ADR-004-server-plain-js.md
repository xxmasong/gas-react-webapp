# ADR-004 — Server in plain JS, typechecked out-of-band

**Status:** Accepted  
**Date:** 2026-05-27

## Context

GAS V8 runs modern JavaScript with no transpile step. Server files are pushed as-is by `clasp`. TypeScript cannot be transpiled at push time without a custom build step that would complicate the deploy pipeline.

## Decision

Server files (`src/server/`) are plain `.js`. Type safety is provided by `tsconfig.server.json` + `src/server/contract.ts`, which asserts that `api.js` implements `ServerFunctions`. `contract.ts` is typechecked but **never pushed**.

## Consequences

- No TypeScript syntax in server files — JSDoc comments for IDE hints only.
- `npm run typecheck` catches client/server contract drift before deploy.
- Server logic is testable in Node without a GAS runtime (especially `lib/` utilities).
