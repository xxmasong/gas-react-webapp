import { useState } from 'react';
import { runningInGas } from './lib/server';
import { useReseed } from './hooks/useReseed';
import { DashboardView } from './features/dashboard';
import { InventoryItemsView } from './features/inventory';
import { CategoriesView } from './features/categories';
import './styles.css';

type Tab = 'dashboard' | 'inventory' | 'categories';

const TABS: Array<{ key: Tab; label: string; icon: JSX.Element }> = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
      </svg>
    ),
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    key: 'categories',
    label: 'Categories',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const reseed = useReseed();

  async function handleReseed() {
    if (!confirm('This will wipe all categories and inventory items, then re-seed from the Product Info sheet. Continue?')) return;
    await reseed.mutateAsync();
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
        {reseed.isError && (
          <span className="reseed-error">Reseed failed: {String(reseed.error)}</span>
        )}
        <button
          className="ghost reseed-btn"
          onClick={handleReseed}
          disabled={reseed.isPending}
          title="Wipe and re-seed all data from the Product Info sheet"
        >
          ↺ Reload data
        </button>
      </header>

      {/* Top tabs — tablet & laptop */}
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'tab active' : 'tab'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'dashboard' && <DashboardView />}
        {tab === 'inventory' && <InventoryItemsView />}
        {tab === 'categories' && <CategoriesView />}
      </main>

      {/* Bottom tab bar — mobile only (CSS controlled) */}
      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'bottom-tab active' : 'bottom-tab'}
            onClick={() => setTab(t.key)}
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
