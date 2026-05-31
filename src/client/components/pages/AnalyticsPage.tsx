import React, { lazy, Suspense } from 'react';
import { formatCurrency, formatQty } from '../../lib/format';
import { useAnalytics } from '../../features/analytics/hooks/useAnalytics';
import { StoreBadge } from '../atoms';
import { AppShell } from '../templates';

const AnalyticsCharts = lazy(() => import('../../features/analytics/components/AnalyticsCharts'));

export const AnalyticsPage: React.FC = () => {
  const a = useAnalytics();

  if (a.error) return <AppShell><div className="error">{a.error}</div></AppShell>;
  if (a.loading) {
    return (
      <AppShell>
        <div className="skeleton-table">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton-row" />)}
        </div>
      </AppShell>
    );
  }
  if (a.isEmpty) return <AppShell><p className="muted">No inventory data to analyze yet.</p></AppShell>;

  const k = a.kpis;

  return (
    <AppShell>
      <div className="analytics">
        <div className="cards">
          <div className="card">
            <span className="card-label">Total value</span>
            <strong className="card-value">{formatCurrency(k.totalValue)}</strong>
          </div>
          <div className="card">
            <span className="card-label">Total quantity</span>
            <strong className="card-value">{formatQty(k.totalQty)}</strong>
          </div>
          <div className="card">
            <span className="card-label">SKUs / categories</span>
            <strong className="card-value">{k.skuCount} / {k.categoryCount}</strong>
          </div>
          <div className={`card ${k.outOfStock > 0 ? 'warn' : ''}`}>
            <span className="card-label">Out of stock</span>
            <strong className="card-value">{k.outOfStock}</strong>
          </div>
          <div className={`card ${k.lowStock > 0 ? 'warn' : ''}`}>
            <span className="card-label">Low stock (≤5)</span>
            <strong className="card-value">{k.lowStock}</strong>
          </div>
          <div className="card">
            <span className="card-label">Dead stock</span>
            <strong className="card-value">{k.deadStock}</strong>
          </div>
          <div className={`card ${k.mismatches > 0 ? 'warn' : ''}`}>
            <span className="card-label">Kyte mismatches</span>
            <strong className="card-value">{k.mismatches}</strong>
          </div>
          <div className="card">
            <span className="card-label">Kyte accuracy</span>
            <strong className="card-value">{k.kyteAccuracy}%</strong>
          </div>
        </div>

        <Suspense fallback={<div className="skeleton-table"><div className="skeleton-row" style={{ height: 260 }} /></div>}>
          <AnalyticsCharts a={a} />
        </Suspense>

        <h3 className="section-title">Needs attention ({a.attention.length})</h3>
        {a.attention.length === 0 ? (
          <p className="muted">All SKUs are above the low-stock threshold. 🎉</p>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Store</th>
                <th className="num">On hand</th>
                <th>Status</th>
                <th className="num">Value</th>
              </tr>
            </thead>
            <tbody>
              {a.attention.slice(0, 50).map((r) => (
                <tr key={r.id}>
                  <td>{r.sku}</td>
                  <td><StoreBadge store={r.store} /></td>
                  <td className="num">{formatQty(r.qtyTotal)}</td>
                  <td>
                    <span
                      className={`kyte-badge ${r.status === 'out' ? 'bad' : ''}`}
                      style={r.status === 'low' ? { background: 'var(--color-warn-bg)', color: 'var(--color-warn-text)' } : undefined}
                    >
                      {r.status === 'out' ? 'Out of stock' : 'Low'}
                    </span>
                  </td>
                  <td className="num">{formatCurrency(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
};
