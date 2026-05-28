import type { ReactNode } from 'react';
import { runningInGas } from '../../lib/server';
import { useReseed } from '../../hooks/useReseed';
import { useView, useToast, useAuth } from '../../providers';
import { TABS } from './tabs';
import { ThemeToggle } from './ThemeToggle';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  inventory_staff: 'Staff',
};

export function Layout({ children }: { children: ReactNode }) {
  const { view, setView } = useView();
  const { user, logout, hasRole, canEditSku } = useAuth();
  const reseed = useReseed();
  const toast = useToast();

  // Only show tabs the current role is allowed to open.
  const visibleTabs = TABS.filter((t) => !t.minRole || hasRole(t.minRole));

  async function handleReseed() {
    if (!confirm('This will wipe all categories and inventory items, then re-seed from the Product Info sheet. Continue?')) return;
    try {
      const result = await reseed.mutateAsync();
      toast.success(`Reseeded ${result.categories} categories and ${result.items} items.`);
    } catch (e) {
      toast.error(`Reseed failed: ${String(e)}`);
    }
  }

  return (
    <div className="app">
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
            ↺ Reload data
          </button>
        )}
        {user && (
          <div className="user-chip">
            <span className="user-name">{user.username}</span>
            <span className="user-role">{ROLE_LABEL[user.role] ?? user.role}</span>
            <button className="ghost logout-btn" onClick={logout} title="Sign out">Sign out</button>
          </div>
        )}
      </header>

      {/* Top tabs — tablet & laptop */}
      <nav className="tabs">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            className={view === t.key ? 'tab active' : 'tab'}
            onClick={() => setView(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>{children}</main>

      {/* Bottom tab bar — mobile only (CSS controlled) */}
      <nav className="bottom-nav">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            className={view === t.key ? 'bottom-tab active' : 'bottom-tab'}
            onClick={() => setView(t.key)}
            aria-label={t.label}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
