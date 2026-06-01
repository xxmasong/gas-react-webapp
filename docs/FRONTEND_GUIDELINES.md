# Frontend Guidelines

Rules and conventions for the React + TypeScript + Vite + Tailwind frontend.
Read [ARCHITECTURE.md](ARCHITECTURE.md) first for system-level context; this doc
is the implementation standard for everything under `src/client/`.

---

## 1. Folder structure

```
src/client/
  main.tsx                      mount only — no logic
  App.tsx                       shell: providers, router, error boundary
  apps/
    PublicApp.tsx               unauthenticated routes (login)
    PrivateApp.tsx              desktop authenticated routes
    MobileApp.tsx               mobile authenticated routes (cashier, counter)
    index.ts
  components/                   Atomic Design shared library
    atoms/                      Button, Badge, Spinner, Input, Label, Icon
    molecules/                  SearchBar, FormField, QuantityControl, AlertBanner
    organisms/                  AppHeader, DataTable, EmptyState, Modal
    templates/                  PageLayout, SidebarLayout, MobileLayout
  features/                     one folder per domain
    reconciliation/
    cashierCount/
    physicalCount/
    posImport/
    comparison/
    investigation/
    approval/
    posting/
    inventory/                  product master (InventoryItems, SkuCategories)
    dashboard/
    analytics/
    users/
    auditLog/
  hooks/                        hooks used by 2+ features
  providers/                    Auth, Theme, Layout, Toast
  routes/
    index.ts                    route definitions
    paths.ts                    path constants
    guards.tsx                  auth + role guards
  lib/
    server.ts                   RPC bridge — the hard boundary (real vs mock)
    errors.ts                   client-side error normalization
    format.ts                   display formatters
    queryKeys.ts                cache key constants
    tokenStore.ts               session token persistence
  config/
    roles.json                  role display labels
    stores.json                 store codes
    inventoryColumns.json       column config for inventory table
  styles.css                    Tailwind base + CSS vars
```

---

## 2. Three-app routing split

The app is split into three sub-apps gated by route prefix and authentication state:

```tsx
// App.tsx
<HashRouter>
  <Routes>
    <Route path="/login" element={<PublicApp />} />
    <Route path="/m/*"   element={<RequireAuth><MobileApp /></RequireAuth>} />
    <Route path="/*"     element={<RequireAuth><PrivateApp /></RequireAuth>} />
  </Routes>
</HashRouter>
```

Route guards live in `routes/guards.tsx`. Never put auth or role logic inside
feature components — use `<RequireRole role="approver">` wrappers at the route level.

### Path constants

All route paths are constants in `routes/paths.ts`. Never hardcode string paths
in `<Link>` or `navigate()` calls.

```ts
// routes/paths.ts
export const PATHS = {
  login:          '/login',
  dashboard:      '/',
  sessions:       '/sessions',
  sessionDetail:  (id: string) => `/sessions/${id}`,
  cashierCount:   (id: string) => `/sessions/${id}/cashier`,
  physicalCount:  (id: string) => `/sessions/${id}/physical`,
  posImport:      (id: string) => `/sessions/${id}/pos-import`,
  comparison:     (id: string) => `/sessions/${id}/comparison`,
  investigation:  (varId: string) => `/variances/${varId}/investigate`,
  approvalQueue:  '/approvals',
  inventory:      '/inventory',
  categories:     '/categories',
  users:          '/users',
  auditLog:       '/audit',
  // Mobile
  mCashier:       (id: string) => `/m/sessions/${id}/cashier`,
  mCounter:       (id: string) => `/m/sessions/${id}/count`,
} as const;
```

---

## 3. Atomic Design — shared components

All **reusable, feature-agnostic** components live in `components/` and follow the
Atomic Design hierarchy.

| Level | What lives here | Rule |
|---|---|---|
| **Atoms** | `Button`, `Input`, `Label`, `Icon`, `Badge`, `Spinner` | No business logic; no data fetching; props only. Never imports molecules/organisms. |
| **Molecules** | `SearchBar`, `FormField`, `QuantityControl`, `AlertBanner`, `ColumnVisibilityMenu` | Composes atoms. May have local UI state. No context, no services. |
| **Organisms** | `AppHeader`, `DataTable`, `EmptyState`, `Modal`, `SessionStatusBadge` | Composes molecules + atoms. May consume context via a hook. No direct `server.*` calls. |
| **Templates** | `PageLayout`, `SidebarLayout`, `MobileLayout` | Structural scaffolding — named slots. No data, no business logic. |

A component belongs in `components/` only if it is used by **two or more features**.
Feature-specific variants stay inside the feature folder. Promote to shared when a
second feature needs them.

---

## 4. Feature modules

Each feature is a self-contained slice understood in isolation.

```
features/reconciliation/
  components/
    SessionList.tsx         routable view — composes organisms/molecules
    SessionCard.tsx         feature-local component
    SessionStatusBadge.tsx  promoted to organisms/ if used elsewhere
  hooks/
    useReconciliationSessions.ts    server state: list, loading, error, CRUD
    useSessionForm.ts               form state, validation, submit
  index.ts                  public surface only — exports the routable view
```

**Rules:**
- Features do not import from other features. Cross-feature data goes through
  `providers/` or app-level context.
- `index.ts` is the **only public surface**. The rest of the app imports from
  `features/reconciliation`, never from `features/reconciliation/hooks/useReconciliationSessions`.
- The routable view imports organisms/molecules but contains no raw Tailwind layout
  primitives — layout belongs in a template.

---

## 5. Design system — shadcn/ui + Tailwind

Components are copy-pasted into `components/atoms/` — you own the code, no
external runtime dep. Built on Radix UI primitives (ARIA-compliant). Fully Tailwind-native.

### CSS variable tokens

Always use CSS variable tokens — never hardcode Tailwind color utilities for semantic colors:

```tsx
// good
<div className="bg-background text-foreground border-border">
<Button className="bg-primary text-primary-foreground">

// bad
<div className="bg-white text-gray-900 border-gray-200">
```

Extend `tailwind.config.ts` for project-specific tokens. One source of truth there.

### Dark mode

Dark mode overrides live in `styles.css` under `.dark { ... }`. Toggle via `ThemeProvider`.

---

## 6. Responsive design

Tailwind is **mobile-first**: unprefixed utilities apply to all sizes.

| Prefix | Min-width | Target |
|---|---|---|
| *(none)* | 0px | Mobile / phones |
| `sm:` | 640px | Large phones |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Laptops |
| `xl:` | 1280px | Desktops |

MobileApp routes target phone-sized viewports (cashier/counter data entry). PrivateApp
targets tablet/desktop (reviewer, approver, manager workflows).

---

## 7. Context and state

| Concern | Solution |
|---|---|
| Auth state, current user, role | `AuthContext` in `providers/AuthProvider.tsx` |
| Theme / display preferences | `ThemeContext` in `providers/ThemeProvider.tsx` |
| Layout (sidebar collapse, etc.) | `LayoutContext` in `providers/LayoutProvider.tsx` |
| Toast notifications | `ToastContext` in `providers/ToastProvider.tsx` |
| Server data (lists, entities) | **Hook only** — not Context |
| Form state | **Local hook** — not Context |
| Cross-component feature state | Feature-scoped context in `features/<name>/` (rarely needed) |

Do not put frequently-changing state in Context — it causes whole-tree re-renders.

---

## 8. Custom hooks

Custom hooks are the primary unit of logic encapsulation.

### When to extract a hook

- Logic is used in two or more components → `hooks/` (shared)
- Logic mixes state + side effects + business rules → feature hook
- A component `useEffect` is longer than ~10 lines → extract
- A function reads from context or calls `server.*` → hook, not component

### Pattern

```ts
// features/reconciliation/hooks/useReconciliationSessions.ts

export function useReconciliationSessions() {
  const [sessions, setSessions] = useState<ReconciliationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await server.listReconciliationSessions();
      setSessions(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (params: NewReconciliationSession) => {
    const session = await server.createReconciliationSession(params);
    setSessions(prev => [session, ...prev]);
    return session;
  }, []);

  useEffect(() => { load(); }, [load]);

  return { sessions, loading, error, create, reload: load };
}
```

**Rules:**
- Name always `useXxx`. File name matches.
- No JSX in hooks — hooks return data and callbacks; components return JSX.
- All `server.*` calls live in hooks — never call `server.*` directly in a component.
- Return objects for 3+ values (not tuples).
- `useCallback` for all action functions so consumers can safely list them as effect deps.

---

## 9. TypeScript standards

- **`strict: true`** — no exceptions.
- **No `any`** — use `unknown` and narrow, or define the type.
- **`type` over `interface`** for all declarations. This is the project convention.

```ts
// good
type ButtonProps = {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
};

// bad — don't use interface
interface ButtonProps {
  label: string;
}
```

- **Shared entity types** live in `src/shared/types.ts` — the contract. Do not duplicate them in feature `types/` files; import and extend with `type`.
- **Type the context, hook returns, and component props explicitly.** Rely on inference only for local variables inside hooks.
- **Computed/derived types** use `Pick`, `Omit`, `Partial`, intersection — don't redefine fields that exist in the source type.

---

## 10. RBAC in the UI

The UI enforces permissions for **convenience only** — the server always enforces them for real. Never rely on UI-only role checks to block actions.

### Role-gated rendering

```tsx
// routes/guards.tsx
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || ROLE_RANK[user.role] < ROLE_RANK[role]) {
    return <Navigate to={PATHS.dashboard} replace />;
  }
  return <>{children}</>;
}
```

Use at the **route level**, not inside feature components:

```tsx
// PrivateApp.tsx
<Route
  path={PATHS.approvalQueue}
  element={
    <RequireRole role="approver">
      <ApprovalQueuePage />
    </RequireRole>
  }
/>
```

### Conditional rendering by role

For hiding UI elements (not blocking routes):

```tsx
const { user } = useAuth();
const canApproveCosts = user && ROLE_RANK[user.role] >= ROLE_RANK['ops_manager'];

{canApproveCosts && <CostDisplay value={varianceValue} />}
```

### Blind count enforcement

The physical count form **never requests** expected/system quantities from the server
for counter-role users. The server enforces this in `physicalCountService.getCountForm`.
The UI must not display any field that was not returned — don't read it from local state.

---

## 11. Error handling and boundaries

```tsx
// App.tsx
<ErrorBoundary fallback={<AppError />}>
  <Suspense fallback={<FullPageSpinner />}>
    <RouterProvider ... />
  </Suspense>
</ErrorBoundary>
```

- **One `ErrorBoundary` at the app shell.** Add a second at the feature level if a feature failure should not crash the rest of the app.
- **Feature hooks own their own `error` state** — shown inline in the feature UI.
- **GAS-specific:** `server.*` calls reject with a string error message from `google.script.run`. `server.ts` normalizes this — don't handle raw GAS errors in hooks.
- Never swallow errors silently (`catch (e) {}`). Log at minimum; surface to user when recovery is possible.

---

## 12. Performance

- **Code-split routes** with `React.lazy` + dynamic `import()`. Each feature's view is a split point. (Note: this is within the single inlined bundle — code splitting still reduces parse time.)
- **`React.memo`** only when profiling confirms unnecessary re-renders.
- **`useMemo` / `useCallback`** for: context provider values (always), and callbacks passed to `React.memo` children.
- **Bundle size:** everything is inlined into one HTML file (GAS constraint). Keep deps lean. Check minified+gzipped size before installing a library.
- **Sheets I/O is the real bottleneck.** Optimistic updates mask latency better than any memoization. Apply optimistic updates in hooks for user-facing write operations.

---

## 13. Accessibility

- Semantic HTML: `<button>` not `<div onClick>`, `<nav>`, `<main>`, `<header>`, `<section>`.
- shadcn/ui (Radix primitives) provides ARIA roles and keyboard behavior — do not override `role`, `aria-*`, or `tabIndex` without understanding the Radix contract.
- Every interactive element must be keyboard reachable (Tab/Shift-Tab, Enter/Space).
- WCAG AA contrast: 4.5:1 normal text, 3:1 large text.
- Decorative icons: `aria-hidden="true"`. Meaningful icons: `aria-label`.
