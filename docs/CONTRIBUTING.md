# Contributing — add or change a feature

The end-to-end recipe for this stack.
**Golden rule: start at the contract, end at the deploy.**

For detailed standards see:
[BACKEND_GUIDELINES.md](BACKEND_GUIDELINES.md) · [FRONTEND_GUIDELINES.md](FRONTEND_GUIDELINES.md) · [DATA_MODEL.md](DATA_MODEL.md)

---

## The 7-step recipe

### 1. Define the contract — `src/shared/types.ts`

Add the entity type and its server functions to `ServerFunctions`. Arguments and
returns must be **JSON-serializable**.

```ts
// src/shared/types.ts
export type ReconciliationSession = {
  id: string;
  branch: string;
  date: string;            // YYYY-MM-DD
  shift: string;
  status: SessionStatus;
  createdAt: string;
};

export type NewReconciliationSession = Omit<ReconciliationSession, 'id' | 'status' | 'createdAt'>;

// Add to ServerFunctions:
createReconciliationSession(token: string, params: NewReconciliationSession): ReconciliationSession;
listReconciliationSessions(token: string): ReconciliationSession[];
```

### 2. Implement the repository — `src/server/repositories/`

One file per Sheet tab. Implement `findAll`, `findById`, `insert`, `softDelete`.

```js
// reconciliationSessionRepository.js
var SHEET_NAME = Config.SHEETS.reconciliationSessions;
var HEADERS = ['id', 'branch', 'date', 'shift', 'status', 'created_by', 'created_at', 'deleted_at'];
```

### 3. Write the mapper — `src/server/mappers/`

Pure functions only — no I/O, no service calls.

```js
// reconciliationSessionMapper.js
function rowToSession(row) { return { id: row[0], branch: row[1], /* … */ }; }
function sessionToRow(s)   { return [s.id, s.branch, /* … */ ]; }
```

### 4. Implement the service — `src/server/services/`

Business logic and rule enforcement here, not in `api.js`.

```js
// reconciliationService.js
function createSession(params) {
  var existing = ReconciliationSessionRepository.findByBranchDateShift(
    params.branch, params.date, params.shift
  );
  if (existing) throw AppError('Session already exists for this branch/date/shift', 'REC_DUPLICATE_SESSION');
  var id = newUuid();
  var session = { id: id, status: 'draft', /* … */ };
  ReconciliationSessionRepository.insert(session);
  AuditService.log(params.createdBy, 'create_session', 'ReconciliationSessions', id);
  return session;
}
```

### 5. Add the RPC shim — `src/server/api.js`

Thin. Validate → check role → delegate → return.

```js
function createReconciliationSession(token, params) {
  AuthService.requireRole(token, ROLE.OPS_MANAGER);
  validate.required(params.branch, 'branch');
  validate.string(params.date, 'date');
  validate.oneOf(params.shift, ['morning', 'afternoon', 'full'], 'shift');
  return ReconciliationService.createSession(params);
}
```

### 6. Wire the client bridge — `src/client/lib/server.ts`

Add the typed wrapper **and** a mock branch (mock parity is required):

```ts
// Real call
createReconciliationSession: (params: NewReconciliationSession) =>
  call('createReconciliationSession', params),

// Inside createMock():
createReconciliationSession: async (params) => {
  const session: ReconciliationSession = {
    id: crypto.randomUUID(),
    ...params,
    status: 'draft',
    createdAt: new Date().toISOString(),
  };
  mockSessions.push(session);
  return session;
},
```

### 7. Build the UI — feature hook + view

```ts
// features/reconciliation/hooks/useReconciliationSessions.ts
export function useReconciliationSessions() {
  const [sessions, setSessions] = useState<ReconciliationSession[]>([]);
  // … load, create, error, loading
  return { sessions, loading, error, create, reload };
}
```

```tsx
// features/reconciliation/components/SessionList.tsx
export function SessionList() {
  const { sessions, loading, error, create } = useReconciliationSessions();
  // render — no server.* calls here
}
```

Export from `features/reconciliation/index.ts` and register the route in `PrivateApp.tsx`.

---

## Checklist before deploying

- [ ] `npm run typecheck` passes with no errors
- [ ] Mock mirrors the real service (same validation, same output shape)
- [ ] New sheet tab name registered in `config.js` under `SHEETS`
- [ ] Role gate added in `api.js` (`AuthService.requireRole`)
- [ ] Audit log called for any approve/post/reopen action
- [ ] Business rules from `BACKEND_GUIDELINES.md §7` verified in service
- [ ] Route added to `PrivateApp.tsx` or `MobileApp.tsx` with correct `<RequireRole>`
- [ ] Path constant added to `routes/paths.ts`
