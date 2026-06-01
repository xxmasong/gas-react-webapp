# ADR-006 — `shared/types.ts` as the client↔server contract

**Status:** Accepted  
**Date:** 2026-05-27

## Context

The client (TypeScript/React) and server (plain JS) are separate execution environments. Without a shared contract, the two sides can drift silently.

## Decision

`src/shared/types.ts` is the single source of truth. It defines:
- All entity types (`InventoryItem`, `ReconciliationSession`, etc.)
- `ServerFunctions` — every callable RPC function with its argument and return types

The client imports it directly. The server asserts conformance via `contract.ts` at typecheck time.

## Consequences

- Changing the contract → both sides' typechecks tell you what drifted.
- New entity = new type + new `ServerFunctions` entry, done in one commit.
- `contract.ts` is never pushed — it's a typecheck artifact only.
