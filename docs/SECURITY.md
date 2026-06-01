# Security

Authentication model, RBAC enforcement, and session policy for the GAS Inventory System.

---

## 1. Authentication

All data functions require a valid session token passed as the first argument.

### Login flow

1. Client calls `login(username, password)`.
2. `authService.login` looks up the user in `Users` sheet; verifies the password hash.
3. On success: creates a `Sessions` row with a UUID token; returns `{ token, user, expiresAt }`.
4. Client stores the token in `tokenStore.ts` (sessionStorage — cleared on tab close).
5. Every subsequent `server.*` call injects the token automatically via the `server.ts` bridge.

### Password hashing

Passwords are hashed server-side using PBKDF2 (GAS `Utilities.computeHmacSha256Signature` with multiple iterations). No plaintext passwords are ever stored or returned.

### Session policy (defined in `config.js AUTH`)

| Parameter | Value |
|---|---|
| Idle TTL | 2 hours (sliding — resets on each call) |
| Absolute TTL | 12 hours (hard cap from login time) |
| Minimum password length | 10 characters |
| Login failure lockout threshold | 5 failures |
| Failure counting window | 15 minutes |
| Lockout duration | 15 minutes |

### Session validation

`AuthService.requireRole(token, minRole)`:
1. Looks up the token in `Sessions` sheet.
2. Checks `revoked_at` is null.
3. Checks `last_active_at` within idle TTL.
4. Checks `created_at` within absolute TTL.
5. Checks `user.active` is true.
6. Checks `user.role` rank ≥ `minRole` rank.
7. Updates `last_active_at`.
8. Returns the public `User` object.

Any failure throws `AppError('...', 'AUTH_...')` — the client surfaces the message.

---

## 2. Role-based access control (RBAC)

RBAC is enforced **server-side in `api.js`**. UI role gates are convenience only —
they cannot be relied upon for security.

### Role hierarchy (highest to lowest rank)

| Role | Rank | Key permissions |
|---|---|---|
| `admin` | 7 | Everything; reopen locked sessions; manage all roles |
| `ops_manager` | 6 | Create/cancel sessions; assign investigations; view costs |
| `reviewer` | 5 | Upload POS; run comparison; request recount; assign investigation |
| `approver` | 4 | Approve/reject variances; post adjustments |
| `cashier` | 3 | Input own cashier count; view own session |
| `counter` | 2 | Blind physical count (assigned sessions); upload evidence |
| `auditor` | 1 | View audit logs, reports, stock card — read-only |

`AuthService.requireRole(token, role)` checks `userRank >= roleRank`.
`AuthService.requireUser(token)` accepts any rank ≥ 1.

### Special restrictions (hardcoded in services, not just role rank)

- **Self-approval (BR-006):** `varianceService.approve` checks `approverId !== investigation.createdById`. Even an admin cannot approve their own critical variance without this being logged.
- **Cashier scope:** cashier can only submit their own count (`cashierCountService` checks `cashierId === currentUserId`).
- **Counter scope:** counter can only submit counts for sessions they are assigned to.
- **Blind count (BR-004):** `physicalCountService.getCountForm` omits `expected_qty` and `system_qty` for the `counter` role regardless of any other permission.

---

## 3. What the UI cannot hide

- **Cost and variance value:** hidden from cashier/counter in the UI. Server strips these fields for roles below `ops_manager`. Never send cost data to lower-role sessions.
- **Expected quantity during blind count:** the server never sends this to counter-role users. The UI must not display what the server doesn't send.

---

## 4. Audit trail (NFR-004)

Every sensitive action is logged to `AuditLogs` (immutable — never updated or deleted):

| Action | Logged |
|---|---|
| Login / logout | Yes |
| Approve variance | Yes (with old/new state) |
| Reject variance | Yes |
| Post adjustments | Yes |
| Reopen locked session | Yes (with reason) |
| Delete / soft-delete any record | Yes |
| Register user / change role / deactivate | Yes |
| Change own password | Yes |

Unauthorized access attempts (wrong role) are also logged by `AuthService`.

---

## 5. Data isolation

- **Auth workbook is separate** from the main data spreadsheet. If someone gains read access to the data sheet, they cannot see password hashes or session tokens.
- **Script Properties** (e.g., `AUTH_SPREADSHEET_ID`) are only accessible to script editors — not to end users of the web app.
- **Cost fields** are permission-restricted. The server strips them from responses for roles below `ops_manager`.

---

## 6. GAS-specific security notes

- **`executeAs: USER_DEPLOYING`** in `appsscript.json` — the script runs as the deploying user's Google account (the spreadsheet owner). End users do not need to be granted Sheets access directly.
- **`access: ANYONE_WITH_GOOGLE_ACCOUNT`** — the web app is restricted to authenticated Google users. Anonymous access is blocked at the GAS level before any of our code runs.
- **No real IP capture** — GAS does not expose the client's IP. `AuditLogs.ip_hint` stores the session/device hint only.
- **No HTTPS concern** — GAS serves over HTTPS by default; we do not manage TLS.
- **CSRF not applicable** — `google.script.run` is a proprietary channel, not a standard HTTP form/fetch endpoint.
