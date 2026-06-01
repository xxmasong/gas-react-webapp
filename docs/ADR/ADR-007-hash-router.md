# ADR-007 — HashRouter for client-side routing

**Status:** Accepted  
**Date:** 2026-05-28

## Context

The GAS iframe serves the entire app from a single `/exec` URL. The server cannot intercept or redirect sub-paths — there is no real URL control at the server level.

## Decision

Use `react-router-dom` with `HashRouter`. All client-side routes use the hash fragment (`/#/path`). The GAS server always serves the same `index.html`; routing happens entirely in the browser.

## Consequences

- Routes look like `https://script.google.com/.../exec#/sessions/abc123`.
- No `BrowserRouter` — it would always load the root route because GAS doesn't understand sub-paths.
- `react-router-dom` is used rather than TanStack Router (simpler, already familiar, no need for the advanced type-safe routing features at this scale).
- Three sub-apps share the router: `PublicApp` (`/login`), `PrivateApp` (`/*`), `MobileApp` (`/m/*`).
