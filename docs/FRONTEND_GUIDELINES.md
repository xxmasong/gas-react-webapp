# Frontend Guidelines

> [!IMPORTANT]
> **Two parts, do not confuse them.**
> - **§0 — Current implementation (AUTHORITATIVE).** This is what the repo actually
>   contains today. Reproduce *this* when recreating the project.
> - **§1 onward — Target architecture (ASPIRATIONAL).** A forward-looking design for
>   when the app grows (shadcn/ui, Tailwind, a router, Atomic Design, Context). **None
>   of it exists in the code yet.** Do **not** reproduce it as current state, and do
>   not assume any file/library mentioned below is present unless §0 lists it.
>
> For the exact file tree and configs see [PROJECT_LAYOUT.md](PROJECT_LAYOUT.md);
> for exact component/hook behavior see [BUSINESS_LOGIC.md](BUSINESS_LOGIC.md).

Read [ARCHITECTURE.md](ARCHITECTURE.md) first for system-level context.

---

## 0. Current implementation (authoritative)

The real frontend is intentionally tiny and uses **plain CSS — no Tailwind, no
shadcn/ui, no router, no state library, no `shared/components` tree.**

### Actual structure
```
src/client/
  main.tsx                         # React mount only (StrictMode → <App/>)
  App.tsx                          # shell: <header> title + live/mock badge; <InventoryView/>
  server.ts                        # re-export shim → lib/server.ts
  styles.css                       # ALL styling (hand-written, GitHub-ish palette)
  vite-env.d.ts                    # `google` global shim + vite client types
  lib/
    server.ts                      # canonical RPC bridge (real gas-client | in-memory mock)
  features/
    inventory/
      index.ts                     # barrel: export { InventoryView }
      components/InventoryView.tsx  # add form + list with +/- qty and delete
      hooks/useInventory.ts         # server state: items/loading/error + add/update/remove/reload
```

### Rules that actually apply today
- **Never call `google.script.run` from a component.** Go through the `server` object
  from `lib/server.ts`, wrapped by a feature hook (`useInventory`). Components never
  import `server` directly either — they use the hook.
- **One feature folder per domain** (`features/inventory/`); its `index.ts` barrel is
  the only public surface.
- **Server state lives in the feature hook**; local UI state (form fields) stays in the
  component via `useState`.
- **Types come from `@shared/types`** via the path alias (see PROJECT_LAYOUT §4), never
  by relative path into `src/shared`.
- **Styling is plain CSS** in `styles.css` using semantic class names (`.app`, `.badge`,
  `.items`, `.add-form`, `.qty`, `.del`). The `live`/`mock` badge classes drive the
  header indicator.

Exact component/hook logic (form rules, optimistic +/- with a floor of 0, error
handling, the mock seed) is specified in [BUSINESS_LOGIC.md §7–§8](BUSINESS_LOGIC.md).

---

# Target architecture (aspirational — NOT yet implemented)

Everything from here down describes where the frontend *could* go. Treat it as a
design proposal, not a description of the current code. Do not create any of these
files/dependencies when reproducing the project.

---

## Table of contents

1. [Folder structure](#1-folder-structure)
2. [Atomic Design — shared components](#2-atomic-design--shared-components)
3. [Feature modules](#3-feature-modules)
4. [Design system — shadcn/ui + Tailwind](#4-design-system--shadcnui--tailwind)
5. [Responsive design](#5-responsive-design)
6. [Context and state](#6-context-and-state)
7. [Custom hooks](#7-custom-hooks)
8. [TypeScript standards](#8-typescript-standards)
9. [Error handling and boundaries](#9-error-handling-and-boundaries)
10. [Accessibility](#10-accessibility)
11. [Performance](#11-performance)

---

## 1. Folder structure

```
src/
  client/
    main.tsx                    # mount only — no logic
    app/
      App.tsx                   # shell: providers, router, error boundary
      router.tsx                # route definitions (hash-based, see note)
    shared/
      components/               # Atomic Design library (atoms → organisms)
        atoms/
        molecules/
        organisms/
      hooks/                    # hooks used by 2+ features
      context/                  # app-wide providers (Theme, Auth, etc.)
      types/                    # types shared across features
      utils/                    # pure, stateless helpers
    features/
      inventory/                # one folder per domain feature
        components/             # feature-specific UI
        hooks/                  # useInventory, useInventoryForm, …
        context/                # feature-scoped providers (if needed)
        types/                  # feature-local types
        index.ts                # barrel — exports the feature's public surface
    lib/
      server.ts                 # RPC bridge (real gas-client vs mock) — DO NOT move
    styles/
      globals.css               # Tailwind base + CSS vars
```

> **GAS note:** route with `hash` mode (`/#/path`) — the GAS iframe has no real
> URL control and the app is served from a single `/exec` entry point.

---

## 2. Atomic Design — shared components

All **reusable, feature-agnostic** components live in `shared/components/` and
follow the Atomic Design hierarchy.

### Levels

| Level | What lives here | Rule |
|---|---|---|
| **Atoms** | `Button`, `Input`, `Label`, `Icon`, `Badge`, `Spinner` | No business logic; no data fetching; props only. Never imports molecules or organisms. |
| **Molecules** | `SearchBar`, `FormField`, `QuantityControl`, `AlertBanner` | Composes atoms. May have local UI state. No context, no services. |
| **Organisms** | `ItemList`, `AppHeader`, `EmptyState` | Composes molecules + atoms. May consume context via a hook. No direct `server.*` calls. |
| **Templates** | `PageLayout`, `SidebarLayout` | Structural scaffolding — named slots (`header`, `main`, `aside`). No data, no business logic. |

Pages live in `features/<name>/` as feature components, not in `shared/`.

### Practical rules

- A component belongs in `shared/` only if it is **used by two or more features** or is clearly design-system-level (buttons, inputs).
- Feature-specific variants stay inside the feature. Promote to `shared/` when a second feature needs them.
- Atoms and molecules must be **fully controlled** (all state as props + callbacks). No `useState` for application data inside atoms.

---

## 3. Feature modules

Each feature is a self-contained slice that can be understood in isolation.

```
features/inventory/
  components/
    InventoryView.tsx     # the routable view — composes organisms/molecules
    ItemRow.tsx           # feature-local organism (not shared yet)
  hooks/
    useInventory.ts       # server state: list, loading, error, CRUD actions
    useInventoryForm.ts   # local form state, validation, submit handler
  context/
    InventoryContext.tsx  # only if the feature needs shared state across sub-components
  types/
    inventory.types.ts    # extends or re-exports from src/shared/types
  index.ts                # exports InventoryView (and anything the rest of the app needs)
```

### Rules

- **Features do not import from other features.** Cross-feature data goes through `shared/` or app-level context.
- `index.ts` is the **only public surface**. The rest of the app imports from `features/inventory`, never from `features/inventory/hooks/useInventory`.
- A feature's routable view (`InventoryView`) is the *page* in Atomic Design terms. It imports organisms/molecules but contains no raw Tailwind layout primitives — layout belongs in a template.

---

## 4. Design system — shadcn/ui + Tailwind

### Choice: shadcn/ui

**Why:** Components are copy-pasted into `shared/components/atoms/` — you own the code, no external runtime dep. Built on Radix UI primitives (ARIA-compliant out of the box). Fully Tailwind-native. TypeScript first.

**Why not DaisyUI:** Semantic CSS classes hide the Tailwind primitives, reducing composability. **Why not Headless UI alone:** requires hand-rolling every visual style; shadcn is already opinionated but fully overrideable.

### Setup

```bash
npx shadcn-ui@latest init          # writes tailwind.config.ts, globals.css CSS vars
npx shadcn-ui@latest add button    # copies Button into shared/components/atoms/
```

### CSS variables for theming

shadcn uses CSS variables in `globals.css`. Customize here — **do not** fork component files to change colors.

```css
/* styles/globals.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    /* … */
  }
  .dark { /* dark mode overrides */ }
}
```

### Rules

- **Use the CSS variable tokens** (`bg-background`, `text-foreground`, `bg-primary`) in all components — never hardcode Tailwind color utilities like `bg-blue-500` for semantic colors.
- Extend `tailwind.config.ts` for project-specific tokens (brand colors, spacing scale, font family). Keep one source of truth there.
- shadcn components land in `shared/components/atoms/`. Rename them to match project conventions (`button.tsx` → `Button.tsx`).

---

## 5. Responsive design

Tailwind is **mobile-first**: unprefixed utilities apply to all sizes; prefixed utilities apply at that breakpoint and above.

### Breakpoints

| Prefix | Min-width | Target |
|---|---|---|
| *(none)* | 0px | Mobile / phones |
| `sm:` | 640px | Large phones |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Laptops / small desktops |
| `xl:` | 1280px | Desktops |
| `2xl:` | 1536px | Large / wide monitors |

### Patterns

**Stacked → grid layout:**
```tsx
<div className="flex flex-col gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
```

**Show/hide by breakpoint:**
```tsx
<nav className="hidden md:flex">        {/* desktop nav */}
<button className="md:hidden">          {/* hamburger — mobile only */}
```

**Fluid typography:**
```tsx
<h1 className="text-xl md:text-2xl lg:text-3xl font-semibold">
```

**Responsive padding / container:**
```tsx
<main className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
```

### Rules

- Always start from the **mobile layout first** — design the narrowest view, then add breakpoint classes to widen.
- Test at: 375px (phone), 768px (tablet), 1024px (laptop), 1440px (desktop), 1920px+ (large monitor).
- Never use absolute pixel widths for layout (`w-[480px]`) — use responsive fractions (`w-full md:w-1/2`).
- Avoid horizontal scroll at any breakpoint. Use `overflow-hidden` on containers only when intentional.

---

## 6. Context and state

### When to use Context

| Concern | Solution |
|---|---|
| Auth state, current user | `AuthContext` in `shared/context/` |
| Theme / display preferences | `ThemeContext` in `shared/context/` |
| Cross-component feature state (rare) | Feature-scoped context in `features/<name>/context/` |
| Server data (items, lists) | **Hook only** (`useInventory`) — not Context |
| Form state | **Local hook** (`useInventoryForm`) — not Context |

Do not put frequently-changing state in Context (causes whole-tree re-renders). Server data belongs in hooks/React Query, not in providers.

### Provider pattern

```tsx
// shared/context/AuthContext.tsx

interface AuthContextValue {
  user: User | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const logout = useCallback(() => setUser(null), []);

  const value = useMemo(() => ({ user, logout }), [user, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
```

### Rules

- **Always create a paired `useXxx` hook** that throws if used outside the provider. Never call `useContext(XxxContext)` directly in components.
- **Memoize the provider value** with `useMemo` to prevent unnecessary re-renders of all consumers when the parent re-renders.
- **Split contexts** when values change independently (`UserContext` + `ThemeContext`, not one `AppContext`).
- Providers are wired in `app/App.tsx` only — never nested deep inside feature components.

---

## 7. Custom hooks

Custom hooks are the primary unit of logic encapsulation. Prefer a well-named hook over any other abstraction.

### When to extract a hook

- Logic is used in **two or more** components → extract to `shared/hooks/`.
- Logic mixes state + side effects + business rules → extract to a feature hook.
- A component `useEffect` is longer than ~10 lines → extract.
- A function reads from context or calls `server.*` → it belongs in a hook, not a component.

### Structure

```ts
// features/inventory/hooks/useInventory.ts

export function useInventory() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => { /* server.getItems() */ }, []);
  const add  = useCallback(async (item: NewItem) => { /* ... */ }, []);
  const remove = useCallback(async (id: string) => { /* ... */ }, []);

  useEffect(() => { load(); }, [load]);

  return { items, loading, error, add, remove, reload: load };
}
```

Components receive the return value and render — they contain no business logic.

### Rules

- **Name:** always `useXxx`. File name matches: `useInventory.ts`.
- **Single responsibility:** one hook, one concern. `useInventory` handles server state; `useInventoryForm` handles form state. Do not merge them.
- **No JSX in hooks.** Hooks return data and callbacks; components return JSX.
- **All `server.*` calls live in hooks** — never call `server.getItems()` directly in a component.
- **Keep const functions inside hooks** with `useCallback` so consumers can safely list them as effect deps.
- **Typed return objects:** return `{ items, loading, error, add, remove }` (not a tuple) for 3+ values.
- Hooks that are feature-specific live in `features/<name>/hooks/`. Only promote to `shared/hooks/` when used by multiple features.

---

## 8. TypeScript standards

- **`strict: true`** in `tsconfig.client.json` — no exceptions.
- **No `any`** — use `unknown` and narrow, or define the type.
- **Type the context, hook returns, and component props explicitly.** Rely on inference for local variables inside hooks.
- **Shared entity types** live in `src/shared/types.ts` — the contract between client and server. Do not duplicate them in feature `types/` files; import and extend.
- **`type` vs `interface`:** use `interface` for object shapes (extendable); use `type` for unions, intersections, mapped types.
- Component props: inline for simple components; named interface (`ButtonProps`) for anything shared.

```ts
// good
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
}
```

---

## 9. Error handling and boundaries

```tsx
// app/App.tsx
<ErrorBoundary fallback={<AppError />}>
  <Suspense fallback={<FullPageSpinner />}>
    <RouterProvider router={router} />
  </Suspense>
</ErrorBoundary>
```

- **One `ErrorBoundary` at the app shell.** Add a second one at the feature level if a feature failure should not crash the rest of the app.
- **Feature hooks own their own `error` state** (shown inline in the feature UI). The boundary is the last resort for uncaught errors.
- **GAS-specific:** `server.*` calls reject with a string error message from `google.script.run`. Normalize in the RPC bridge (`server.ts`), not in individual hooks.
- Never swallow errors silently (`catch (e) {}`). Log to console at minimum; surface to the user when recovery is possible.

---

## 10. Accessibility

- Use **semantic HTML** — `<button>` not `<div onClick>`, `<nav>`, `<main>`, `<header>`, `<section>`.
- shadcn/ui (Radix primitives) provides ARIA roles and keyboard behavior automatically — do not override `role`, `aria-*`, or `tabIndex` on shadcn components without understanding the Radix contract.
- Every interactive element must be reachable by **keyboard** (Tab/Shift-Tab to focus, Enter/Space to activate).
- **Color contrast:** WCAG AA — 4.5:1 for normal text, 3:1 for large text. The shadcn default palette meets this; verify if you customize CSS variables.
- Images and icons that convey meaning need `alt` / `aria-label`. Decorative icons get `aria-hidden="true"`.

---

## 11. Performance

- **Code-split routes** with `React.lazy` + dynamic `import()`. Each feature's view is a split point.
- **`React.memo`** only when profiling confirms unnecessary re-renders. Default: don't memo.
- **`useMemo` / `useCallback`** for: context provider values (always), and callbacks passed to `React.memo` children (otherwise skip).
- **Bundle size:** this project inlines everything into one HTML file (GAS constraint). Keep deps lean. Before installing a library, check its minified+gzipped size. Prefer tree-shakeable packages.
- **Sheets I/O is the real bottleneck,** not JS. Optimistic updates (`useInventory` already does this) mask latency better than any memoization.
