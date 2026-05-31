import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Role, User } from '@shared/types';
import { ROLE_RANK } from '@shared/types';
import { server, setToken, getToken } from '../lib/server';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (min: Role) => boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  canEditSku: boolean;
  canUpdateCounts: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type Props = {
  children: ReactNode;
};

export const AuthProvider: React.FC<Props> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
          else setToken(null);
        }
      } catch {
        if (!cancelled) setToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const session = await server.login(username, password);
    setToken(session.token);
    setUser(session.user);
  }, []);

  const logout = useCallback(async () => {
    try { await server.logout(); } catch { /* ignore */ }
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const rank = user ? ROLE_RANK[user.role] : 0;
    return {
      user,
      loading,
      login,
      logout,
      hasRole: (min: Role) => rank >= ROLE_RANK[min],
      isAdmin:         rank >= ROLE_RANK.admin,
      isSupervisor:    rank >= ROLE_RANK.supervisor,
      canEditSku:      rank >= ROLE_RANK.supervisor,
      canUpdateCounts: rank >= ROLE_RANK.inventory_staff,
    };
  }, [user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
