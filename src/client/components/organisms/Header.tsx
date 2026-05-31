import React, { useCallback, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { runningInGas } from '../../lib/server';
import { useReseed } from '../../hooks/useReseed';
import { useToast, useAuth } from '../../providers';
import { cleanError } from '../../lib/errors';
import { ROLE_HEADER_LABEL } from '../../config';
import { Spinner } from '../atoms';
import { ThemeToggle } from '../molecules';
import { TABS } from './tabs';

export const Header: React.FC = () => {
  const { user, logout, hasRole, canEditSku } = useAuth();
  const reseed = useReseed();
  const toast = useToast();
  const [loggingOut, setLoggingOut] = useState(false);

  const visibleTabs = useMemo(
    () => TABS.filter((t) => !t.minRole || hasRole(t.minRole)),
    [hasRole],
  );

  const handleReseed = useCallback(async () => {
    if (!confirm('This will wipe all categories and inventory items, then re-seed from the Product Info sheet. Continue?')) return;
    try {
      const result = await reseed.mutateAsync();
      toast.success(`Reseeded ${result.categories} categories and ${result.items} items.`);
    } catch (e) {
      toast.error(`Reseed failed: ${cleanError(e)}`);
    }
  }, [reseed, toast]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    await logout();
  }, [logout]);

  return (
    <>
      {reseed.isPending && (
        <div className="reseed-overlay">
          <div className="reseed-spinner" />
          <p className="reseed-label">Reseeding from Product Info sheet…</p>
          <p className="reseed-sub">This may take up to a minute. Please wait.</p>
        </div>
      )}

      <header>
        <h1>Inventory</h1>
        <span className={`badge ${runningInGas ? 'live' : 'mock'}`}>
          {runningInGas ? 'Sheets backend' : 'local mock'}
        </span>
        <ThemeToggle />
        {canEditSku && (
          <button
            className="ghost reseed-btn"
            onClick={handleReseed}
            disabled={reseed.isPending}
            title="Wipe and re-seed all data from the Product Info sheet"
          >
            {reseed.isPending ? <Spinner size={13} /> : '↺'} Reload data
          </button>
        )}
        {user && (
          <div className="user-chip">
            <span className="user-name">{user.username}</span>
            <span className="user-role">{ROLE_HEADER_LABEL[user.role] ?? user.role}</span>
            <button
              className="ghost logout-btn"
              disabled={loggingOut}
              title="Sign out"
              onClick={handleLogout}
            >
              {loggingOut && <Spinner size={12} />}
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        )}
      </header>

      <nav className="tabs">
        {visibleTabs.map((t) => (
          <NavLink
            key={t.path}
            to={t.path}
            className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      <nav className="bottom-nav">
        {visibleTabs.map((t) => (
          <NavLink
            key={t.path}
            to={t.path}
            className={({ isActive }) => (isActive ? 'bottom-tab active' : 'bottom-tab')}
            aria-label={t.label}
          >
            {t.icon}
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
};
