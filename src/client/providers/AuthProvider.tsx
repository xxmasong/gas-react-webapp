import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Role, User } from '@shared/types';
import { server, setToken, getToken } from '../lib/server';

type AuthContextValue = {
  user: User | null;
  loading: boolean;            // true while validating a stored token on mount
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** True if the current user's role rank is >= the given role. */
  hasRole: (min: Role) => boolean;
  isAdmin: boolean;
  isSupervisor: boolean;       // supervisor or admin
  canEditSku: boolean;         // supervisor or admin
  canUpdateCounts: boolean;    // any signed-in user
};

const AuthContext = createContext<AuthContextValue | null>(null);

const RANK: Record<Role, number> = { inventory_staff: 1, supervisor: 2, admin: 3 };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, if we have a stored token, ask the server who we are.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await server.me();
        if (!cancelled) {
          if (me) setUser(me);
          else setToken(null); // stale/expired token
        }
      } catch {
        if (!cancelled) setToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function login(username: string, password: string) {
    const session = await server.login(username, password);
    setToken(session.token);
    setUser(session.user);
  }

  async function logout() {
    try { await server.logout(); } catch { /* ignore */ }
    setToken(null);
    setUser(null);
  }

  const rank = user ? RANK[user.role] : 0;
  const value: AuthContextValue = {
    user,
    loading,
    login,
    logout,
    hasRole: (min) => rank >= RANK[min],
    isAdmin: rank >= RANK.admin,
    isSupervisor: rank >= RANK.supervisor,
    canEditSku: rank >= RANK.supervisor,
    canUpdateCounts: rank >= RANK.inventory_staff,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
