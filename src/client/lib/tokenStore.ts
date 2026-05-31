// Session token persisted in localStorage and injected into every authed RPC call.
const TOKEN_KEY = 'inventory.session';

let current: string | null =
  typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;

export function setToken(token: string | null): void {
  current = token;
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return current;
}
