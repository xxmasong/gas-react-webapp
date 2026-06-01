# ADR-002 — RPC via `google.script.run` wrapped by gas-client

**Status:** Accepted  
**Date:** 2026-05-27

## Context

The GAS iframe has no `fetch`, no WebSockets, and no REST endpoints. The only sanctioned browser→server channel is `google.script.run`.

## Decision

Use `gas-client` to wrap `google.script.run` as typed promises. Hide it behind `src/client/lib/server.ts` — the only file in the codebase that touches the transport layer.

## Consequences

- All server calls go through `server.ts`. Components and hooks never call `google.script.run` directly.
- Arguments and returns must be JSON-serializable (no Dates, functions, class instances).
- The bridge branches on whether a GAS host is present, enabling local dev without deploying.
- Round-trips are slow (~500ms–2s). Optimistic updates and caching are necessary for good UX.
