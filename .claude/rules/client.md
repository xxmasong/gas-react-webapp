---
paths:
  - "src/client/**/*.ts"
  - "src/client/**/*.tsx"
---

# Client layer rules

You are editing the React frontend. These rules are absolute.

## The hard boundary

`src/client/lib/server.ts` is the **only** file that may call `google.script.run`.
Never import gas-client or reference google.script anywhere else.

## Where server calls live

All `server.*` calls go in **feature hooks** (`features/*/hooks/use*.ts`).
Never call `server.*` from a component — not even `useEffect` in a component.

## Feature module isolation

- Features do not import from other features
- `features/xyz/index.ts` is the only public surface — never import deeper paths
- If two features need the same component, it belongs in `components/` not either feature

## Hook pattern (always follow this)

```ts
export function useXxx(param?: Type) {
  const [data, setData] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await server.getXxx(param)); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, [param]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}
```

- Always named `useXxx`, file name must match
- Return objects (not tuples) when returning 3+ values
- `useCallback` on all action functions passed down

## Atomic design levels — strict

| Level | May use | May NOT use |
|---|---|---|
| `atoms/` | props only | context, hooks, server.* |
| `molecules/` | atoms + local state | context, server.* |
| `organisms/` | molecules + context hooks | direct server.* |
| `templates/` | layout/slots only | data, logic, server.* |

## Routing

- Route paths are **constants** in `src/client/routes/paths.ts` — never hardcode strings
- `<RequireRole>` wraps routes — never gates inside components
- To add a route: `paths.ts` → `PrivateApp.tsx`/`MobileApp.tsx` → `<RequireRole>` if needed

## TypeScript

- `type` over `interface` — no exceptions anywhere in the codebase
- No `any` — use `unknown` + narrowing or define the type
- No duplicate type definitions — import from `@shared/types`
- Derived types use `Pick`, `Omit`, `Partial` — never redefine existing fields

## State

| State type | Where |
|---|---|
| Auth + current user | `AuthContext` via `useAuth()` |
| Server data | Feature hooks — never Context |
| Form state | Local `useState` — never Context |
| Theme | `ThemeContext` via `useTheme()` |

## RBAC

UI gates are **convenience only** — the server enforces real access.
```tsx
// Correct — route level
<Route element={<RequireRole role="supervisor"><CategoriesPage /></RequireRole>} />

// Correct — hide UI elements
const { user } = useAuth();
{ROLE_RANK[user.role] >= ROLE_RANK['supervisor'] && <EditButton />}
```
