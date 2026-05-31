import React, { useMemo } from 'react';
import { formatCurrency, formatQty } from '../../lib/format';
import { useDashboard } from '../../features/dashboard/hooks/useDashboard';
import { AppShell } from '../templates';

export const DashboardPage: React.FC = () => {
  const { summary, totals, loading, error } = useDashboard();

  const sorted = useMemo(
    () => [...totals].sort((a, b) => b.totalCost - a.totalCost),
    [totals],
  );

  if (error) return <AppShell><div className="error">{error}</div></AppShell>;
  if (loading || !summary) return <AppShell><p className="muted">Loading…</p></AppShell>;

  return (
    <AppShell>
      <div className="cards">
        <div className="card">
          <span className="card-label">Total value</span>
          <strong className="card-value">{formatCurrency(summary.totalCost)}</strong>
        </div>
        <div className="card">
          <span className="card-label">Total qty</span>
          <strong className="card-value">{formatQty(summary.totalQty)}</strong>
        </div>
        <div className="card">
          <span className="card-label">SKUs / categories</span>
          <strong className="card-value">{summary.skuCount} / {summary.categoryCount}</strong>
        </div>
        <div className={`card ${summary.mismatchCount > 0 ? 'warn' : ''}`}>
          <span className="card-label">Kyte mismatches</span>
          <strong className="card-value">{summary.mismatchCount}</strong>
        </div>
      </div>

      <h3 className="section-title">Category breakdown</h3>
      <table className="grid">
        <thead>
          <tr>
            <th>Code</th>
            <th>Category</th>
            <th className="num">SKUs</th>
            <th className="num">Qty</th>
            <th className="num">Value</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={t.categoryId}>
              <td><code>{t.categoryCode}</code></td>
              <td>{t.categoryName}</td>
              <td className="num">{t.skuCount}</td>
              <td className="num">{formatQty(t.totalQty)}</td>
              <td className="num">{formatCurrency(t.totalCost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
};
