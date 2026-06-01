# ADR-003 — In-memory mock backend for local dev

**Status:** Accepted  
**Date:** 2026-05-27

## Context

`npm run dev` starts a Vite server that has no access to the GAS runtime. Without a mock, the entire UI is unbuildable offline.

## Decision

`server.ts` includes a `createMock()` function — an in-memory implementation that mirrors the real server API. It is activated automatically when `google.script.run` is not present (i.e., not inside the GAS iframe).

## Consequences

- The full UI can be built and iterated offline.
- Mock parity is part of the definition of done: every server function change requires a matching mock update in the same commit.
- The mock does not persist to disk — in-memory arrays reset on page reload, which is intentional.
- The header badge (`local mock` vs `Sheets backend`) makes the active mode visible.
