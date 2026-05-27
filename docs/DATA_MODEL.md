# Data model — Google Sheets as the database

The backend "database" is a single Google Spreadsheet bound to the Apps Script
project. Each **entity is one tab (sheet)**; the **header row is the schema**.

## Current schema

### `Items` tab
| Column | Type | Notes |
|---|---|---|
| `id` | string (UUID) | `Utilities.getUuid()`, assigned server-side. Primary key. |
| `name` | string | Required. |
| `quantity` | number | Defaults to 0. |
| `updatedAt` | string (ISO) | `new Date().toISOString()`, set on every write. |

Defined by `HEADERS` in [../src/server/sheets.js](../src/server/sheets.js). The tab
auto-creates with a frozen header row on first access.

## Conventions

- **One tab per entity.** Tab name + `HEADERS` array define it.
- **Header row = column contract.** Row 1 is frozen and maps positionally to the
  entity fields via `rowToItem_`-style mappers. Order matters.
- **UUID primary keys.** Generated server-side, never by the client.
- **Timestamps in ISO 8601 strings.** Sheets stores them as text; we never rely on
  Sheets date types.
- **`id` is the lookup key.** `findRowById_` scans the id column to resolve a row
  number. This is O(n) — fine for hundreds/low-thousands of rows, not millions.

## Hard limits of Sheets-as-DB (design around these)

| No… | Mitigation |
|---|---|
| Transactions | Wrap every **write** in `LockService.getScriptLock()` to serialize concurrent mutations and avoid read-then-write races. |
| Indexes / fast lookup | Linear scans. Keep tabs small; cache hot reads with `CacheService`. |
| Joins | Denormalize, or do the join in the service layer in memory. |
| Cheap per-cell I/O | Batch with `getRange(...).getValues()` / `setValues()`. Never read/write cell-by-cell in a loop. |
| Large datasets | Sheets has cell-count limits; this is for app data, not analytics volumes. |

## Adding a new entity

1. Add the type + functions to `src/shared/types.ts` (the contract).
2. In `sheets.js`, define a new `SHEET_NAME` + `HEADERS` (or use a generalized
   `sheetRepo(name, headers)` helper if present) and row mappers.
3. Implement the RPC functions in `api.js` (+ logic in `services/`).
4. Wire client wrapper + mock in `server.ts`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full end-to-end recipe.

## Where the live data lives

The bound spreadsheet and script IDs are recorded in
[DEPLOY_URL.md](DEPLOY_URL.md).
