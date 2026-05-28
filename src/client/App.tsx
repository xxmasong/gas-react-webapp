import { useState } from 'react';
import { runningInGas } from './lib/server';
import { useReseed } from './hooks/useReseed';
import { DashboardView } from './features/dashboard';
import { InventoryItemsView } from './features/inventory';
import { CategoriesView } from './features/categories';
import './styles.css';

type Tab = 'dashboard' | 'inventory' | 'categories';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'categories', label: 'Categories' },
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
    </div>
  );
}
