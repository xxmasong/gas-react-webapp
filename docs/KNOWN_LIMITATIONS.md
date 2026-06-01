# Known Limitations

GAS-imposed constraints, Sheets limits, and deliberate non-goals. Read this before
proposing architecture changes — these are not bugs, they are the design envelope.

---

## 1. Google Apps Script runtime constraints

| Limitation | Impact | Mitigation |
|---|---|---|
| **~6 min execution cap per call** | Large POS imports (10k+ rows) may time out | Chunk imports; process in batches; use time-based triggers for background work |
| **No `fetch` / REST / WebSockets from the browser** | All transport is via `google.script.run` | Accepted — the RPC bridge is the only channel |
| **No persistent in-process state** | Each `google.script.run` call starts fresh | Use `CacheService` for hot reads; `LockService` for write serialization |
| **No multi-threading / workers** | All server work is single-threaded per call | Design for fast calls; defer heavy work |
| **No real-time push / subscriptions** | UI cannot receive server-initiated events | Poll on a timer if status updates are needed in real time |
| **`CacheService` max TTL: 6 hours** | Cache always stale after 6h | Acceptable; writes invalidate the relevant cache key |
| **`CacheService` max value size: ~100KB** | Very large datasets can't be cached as one entry | Split cache by entity ID or use pagination |
| **No real IP address available** | Audit logs store a session hint, not a real IP | Accepted — GAS doesn't expose client IPs |

---

## 2. Google Sheets database constraints

| Limitation | Impact | Mitigation |
|---|---|---|
| **No transactions** | Concurrent writes can race | `LockService.getScriptLock()` on all writes — serializes mutations |
| **No indexes** | All lookups are linear O(n) scans | Acceptable up to ~5k rows per tab; use `CacheService` for hot reads |
| **No foreign key enforcement** | Referential integrity is application-level | Enforced in services; repositories don't validate FKs |
| **No joins** | Cross-tab queries require in-memory joins | Service layer loads both datasets and joins in JS |
| **Cell-count limit (~10M cells per spreadsheet)** | Hard cap on total data | This system is for operational records, not analytics volumes; archiving is future work |
| **Sheets date type ambiguity** | Sheets auto-converts strings to dates | Always store timestamps as ISO 8601 text; never rely on Sheets date formatting |
| **Row append is slow under lock contention** | High-write periods (e.g., posting) are serialized | Posting is intentionally atomic; accept the serialization cost |

---

## 3. Bundling constraint

| Limitation | Impact | Mitigation |
|---|---|---|
| **Single self-contained HTML file** | No code splitting at the network level; no external assets | Keep dependencies lean; use tree-shaking; `React.lazy` still reduces JS parse time |
| **No CDN or external JS/CSS at runtime** | All deps must be inlined | Check bundle size before adding any library |
| **No separate service worker** | No offline mode beyond what the mock provides | The mock covers local dev; PWA/offline is out of scope |

---

## 4. Routing constraint

| Limitation | Impact | Mitigation |
|---|---|---|
| **No real URL control (GAS serves `/exec` only)** | Cannot use BrowserRouter | HashRouter (`/#/path`) — all routes are hash fragments |
| **Deep links require the app to load first** | Sharing a direct link to a variance detail loads the shell, then navigates | Acceptable for operational use; users are typically already logged in |

---

## 5. Deliberate non-goals (out of scope per SRS)

These are not missing features — they are explicitly excluded:

- **General ledger / BIR filing / payroll / AR/AP** — full accounting ERP is a separate system.
- **Manufacturing BOM / production planning / recipe costing** — not in this SRS.
- **Automated POS sync** — P3 (future); for now, POS data is imported via CSV/XLSX upload.
- **Analytics automation** (trends, auto-assign, reorder suggestion) — P3.
- **Receiving, transfers, damage/expiry workflows** — P2 (planned but not P1).
- **Multi-currency** — not required by the client's current operations.
- **Native mobile app** — the MobileApp sub-app is a mobile-optimized web view, not a native app.

---

## 6. Known gaps in the current implementation (P1 in progress)

These are features specified in the SRS that are not yet implemented:

- `StockMovements` ledger + `inventoryComputationService` — the most critical gap
- `ReconciliationSessions` full status machine
- `CashierCounts`, `PhysicalCounts` entities and UI
- POS import pipeline (`PosImportBatches`, `PosImportLines`, SKU mapping)
- 3-way comparison engine + `ReconciliationResults`
- `VarianceInvestigations` + `VarianceApprovals` workflow
- `postingService` — approved adjustments → ledger entries
- Expanded role model (currently `admin`, `supervisor`, `inventory_staff` only)
- All reconciliation UI screens (session list, cashier entry, physical count, POS import, comparison, investigation, approval queue, posting)
- Audit log viewer UI
- Variance and accountability reports

The existing codebase implements: product master (InventoryItems + SkuCategories), auth (users + sessions + RBAC), dashboard summary, analytics view, direct stock editing (deprecated — to be replaced by the ledger).
