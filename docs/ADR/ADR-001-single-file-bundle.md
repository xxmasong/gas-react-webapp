# ADR-001 — Single-file frontend bundle

**Status:** Accepted  
**Date:** 2026-05-27

## Context

Google Apps Script HtmlService can only serve one self-contained HTML file per deployment. It cannot serve separate JS, CSS, or asset files.

## Decision

Use `vite-plugin-singlefile` to inline all JavaScript, CSS, and assets into `dist/index.html` at build time. This is the only viable approach given the GAS constraint.

## Consequences

- No code splitting at the network level (though `React.lazy` still reduces parse time).
- Bundle must remain lean — every dependency is inlined.
- Before installing any library, check its minified+gzipped size.
- No CDN loads at runtime.
