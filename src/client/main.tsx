import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, LayoutProvider, ToastProvider, AuthProvider } from './providers';
import { getToken } from './lib/tokenStore';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // GAS cold-starts can take 5–8 s; don't hammer on retry
      retry: 1,
      retryDelay: 2000,
      // Inventory/categories change slowly. Keep data fresh for 5 min so we
      // don't pay a cold GAS round-trip every 30 s; serve cached instantly.
      staleTime: 5 * 60_000,
      // Keep unused data in memory for an hour so navigating back is instant.
      gcTime: 60 * 60_000,
    },
  },
});

// ─── Lightweight cache persistence (no extra deps) ───────────────────────────
// Snapshot the query cache to localStorage so a returning user sees data
// instantly on load, before any RPC fires. Keyed (busted) by the current
// session token so one user never rehydrates another user's cached data.
const PERSIST_KEY = 'inventory.qcache';
const PERSIST_MAX_AGE = 24 * 60 * 60_000; // 24 h
const PERSIST_MAX_BYTES = 4 * 1024 * 1024; // stay under localStorage ~5 MB

type PersistedCache = {
  buster: string;
  savedAt: number;
  state: unknown;
};

function persistBuster(): string {
  return getToken() ?? 'anon';
}

function restoreCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PersistedCache;
    const fresh = Date.now() - parsed.savedAt < PERSIST_MAX_AGE;
    if (parsed.buster !== persistBuster() || !fresh) {
      window.localStorage.removeItem(PERSIST_KEY);
      return;
    }
    const queries = (parsed.state as { queries?: unknown[] })?.queries;
    if (!Array.isArray(queries)) return;
    const cache = queryClient.getQueryCache();
    for (const q of queries as Array<{
      queryKey: unknown[];
      queryHash: string;
      state: { data: unknown; dataUpdatedAt: number };
    }>) {
      if (q?.state?.data === undefined) continue;
      cache.build(queryClient, { queryKey: q.queryKey, queryHash: q.queryHash }).setData(
        q.state.data,
        { updatedAt: q.state.dataUpdatedAt, manual: true },
      );
    }
  } catch {
    try { window.localStorage.removeItem(PERSIST_KEY); } catch { /* ignore */ }
  }
}

function persistCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const queries = queryClient
      .getQueryCache()
      .getAll()
      .filter((q) => q.state.status === 'success' && q.state.data !== undefined)
      .map((q) => ({
        queryKey: q.queryKey,
        queryHash: q.queryHash,
        state: { data: q.state.data, dataUpdatedAt: q.state.dataUpdatedAt },
      }));
    const payload: PersistedCache = {
      buster: persistBuster(),
      savedAt: Date.now(),
      state: { queries },
    };
    const json = JSON.stringify(payload);
    if (json.length > PERSIST_MAX_BYTES) {
      window.localStorage.removeItem(PERSIST_KEY);
      return;
    }
    window.localStorage.setItem(PERSIST_KEY, json);
  } catch {
    // Quota or serialization failure — persistence is best-effort only.
    try { window.localStorage.removeItem(PERSIST_KEY); } catch { /* ignore */ }
  }
}

restoreCache();

// Persist on changes (debounced) and on tab hide/unload.
if (typeof window !== 'undefined') {
  let timer: ReturnType<typeof setTimeout> | null = null;
  queryClient.getQueryCache().subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(persistCache, 1000);
  });
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistCache();
  });
  window.addEventListener('pagehide', persistCache);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <HashRouter>
            <AuthProvider>
              <LayoutProvider>
                <App />
              </LayoutProvider>
            </AuthProvider>
          </HashRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
);
