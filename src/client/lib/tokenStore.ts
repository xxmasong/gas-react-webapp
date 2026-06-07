// Session token persisted in localStorage and injected into every authed RPC call.
const TOKEN_KEY = 'inventory.session';

let current: string | null =
  typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;

// Persisted query-cache key (see main.tsx). Cleared on token change so a new
// login never rehydrates the previous user's cached data.
const QCACHE_KEY = 'inventory.qcache';

export function setToken(token: string | null): void {
  const changed = token !== current;
  current = token;
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
  if (changed) window.localStorage.removeItem(QCACHE_KEY);
}

export function getToken(): string | null {
  return current;
}
