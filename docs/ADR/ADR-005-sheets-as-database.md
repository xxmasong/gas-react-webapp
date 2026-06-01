# ADR-005 — Google Sheets as the database

**Status:** Accepted  
**Date:** 2026-05-27

## Context

The system runs entirely within the Google ecosystem. No external database can be provisioned without infrastructure and billing outside the client's current setup. The client already has a Google Workspace account.

## Decision

Use Google Sheets as the database. One tab per entity. The header row defines the schema. Data is read/written via `SpreadsheetApp` in the GAS backend.

## Consequences

- Zero infra cost; lives in the user's Drive.
- No transactions, no indexes, no joins — all mitigated by: `LockService` on writes, linear scans (acceptable at hundreds-to-low-thousands rows), and in-memory joins in the service layer.
- `CacheService` is used to reduce repeated reads of hot data.
- Sheets has cell-count limits — this system is for app/operational data, not analytics volumes.
- The auth workbook is stored in a **separate spreadsheet** from the main data sheet (security isolation).

## Alternative considered

Cloud SQL / Firestore via GAS `UrlFetchApp`. Rejected: requires additional Google Cloud billing, IAM setup, and network calls within GAS execution time limits.
