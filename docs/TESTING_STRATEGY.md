# Testing Strategy

How to verify correctness of this system. We have no automated test runner in the
GAS environment — all testing is a combination of TypeScript typecheck, mock-backend
dev, and structured UAT.

---

## 1. Layers of verification

| Layer | Tool | When |
|---|---|---|
| Contract drift | `npm run typecheck` | Before every deploy |
| Local functional dev | Mock backend + `npm run dev` | During feature development |
| Integration | Deployed GAS app against real Sheets | After every deploy |
| UAT acceptance | Structured test case checklist (§3) | Before marking a feature done |

---

## 2. Mock backend parity (dev-time)

The in-memory mock in `server.ts` is the primary dev-time test surface.

**Mock must mirror the real service for:**
- Input validation (same error conditions)
- Output shape (same fields, same types)
- Business rule side effects (e.g., cashier count locks after submit)
- Status transitions (same allowed transitions)

When adding a feature, exercise all happy paths and edge cases in `npm run dev`
before deploying. The mock is fast and restartable — use it aggressively.

---

## 3. UAT test cases (acceptance criteria from SRS)

Run these against the live deployed app after any reconciliation-related deploy.

| TC | Module | Scenario | Steps | Expected |
|---|---|---|---|---|
| TC-001 | Session | Create valid session | Login as ops_manager; create session with valid branch/date/shift | Session created in `draft` status |
| TC-002 | Session | Duplicate blocked | Create same branch/date/shift twice | Second creation returns ERR_DUPLICATE_SESSION |
| TC-003 | Cashier | Expected ending formula | Opening 50, sold 15, returns 2 | Expected ending = 37 |
| TC-004 | Cashier | Return condition required | Submit return qty > 0 without condition | Blocked with validation error |
| TC-005 | Physical | Blind mode | Counter opens count screen | Expected/system qty not visible |
| TC-006 | Physical | Damage separated | Input sellable 10, damaged 2 | Damaged excluded from comparison physical_qty |
| TC-007 | POS | Valid import | Upload valid mapped CSV | Import succeeds; all rows accepted |
| TC-008 | POS | Unmapped SKU | Upload CSV with unknown POS code | Row flagged; reconciliation blocked until mapped |
| TC-009 | Comparison | Matched case | Cashier=20, physical=20, system=20 | Classification: `matched` |
| TC-010 | Comparison | Shortage case | Cashier=20, system=20, physical=18 | Classification: `physical_shortage`, variance=-2 |
| TC-011 | Comparison | Cashier mismatch | Cashier=18, physical=20, system=20 | Classification: `cashier_mismatch` |
| TC-012 | Comparison | System mismatch | Cashier=10, physical=10, system=12 | Classification: `system_mismatch` |
| TC-013 | Comparison | All different | Cashier=9, physical=8, system=10 | Classification: `critical` |
| TC-014 | Investigation | Assign task | Assign critical variance | Investigation task created; assignee notified |
| TC-015 | Approval | Block missing evidence | Approve critical variance without evidence | Blocked with ERR_MISSING_EVIDENCE |
| TC-016 | Approval | Self-approval blocked | Approver tries to approve own variance | Blocked with ERR_SELF_APPROVAL |
| TC-017 | Posting | Post approved adjustment | Approve and post shortage adjustment | StockMovements entry created; balance updates |
| TC-018 | Security | Cashier approval blocked | Cashier tries to approve | Blocked by role check; action logged |
| TC-019 | Locking | Edit locked session | Edit after posting | Blocked with ERR_SESSION_LOCKED |
| TC-020 | Audit | Sensitive action logged | Approve variance | AuditLogs entry: user, action, entity, old/new, timestamp |
| TC-021 | Stock | No direct edit | Attempt direct qty write via any RPC | No such function exists; only postingService creates movements |

---

## 4. Typecheck gate

`npm run typecheck` must pass before every deploy. It catches:
- Mismatches between `ServerFunctions` and `api.js` implementations
- Type errors in feature hooks and components
- Contract drift when entity types change

If typecheck fails, do not deploy.

---

## 5. Smoke test checklist (post-deploy)

After `npm run deploy`:

- [ ] `/exec` URL loads the login screen
- [ ] Login succeeds with a known user
- [ ] Dashboard loads (no blank screen, no JS errors in console)
- [ ] Inventory list loads from real Sheets data
- [ ] Header badge shows `Sheets backend` (not `local mock`)
- [ ] Role-gated pages redirect correctly for insufficient-role users

---

## 6. What we do not have (and why)

- **No Jest / unit tests:** GAS V8 has no Node.js runtime compatibility layer for server code. `lib/` utilities could be unit tested in Node (they have no GAS deps), but this is not yet set up.
- **No Playwright / E2E tests:** The GAS iframe has auth gates (Google sign-in) that make automated browser testing impractical without service account tooling.
- **No CI pipeline:** clasp push is manual. A CI gate running `npm run typecheck` + `npm run build` would be a meaningful improvement.
