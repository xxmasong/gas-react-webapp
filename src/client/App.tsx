import { useState } from 'react';
import { runningInGas } from './lib/server';
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

  return (
    <div className="app">
      <header>
        <h1>Inventory</h1>
        <span className={`badge ${runningInGas ? 'live' : 'mock'}`}>
          {runningInGas ? 'Sheets backend' : 'local mock'}
        </span>
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
