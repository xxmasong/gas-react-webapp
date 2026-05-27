import { formatCurrency, formatQty } from '../../../lib/format';
import { useDashboard } from '../hooks/useDashboard';

export function DashboardView() {
  const { summary, totals, loading, error } = useDashboard();

  if (error) return <div className="error">{error}</div>;
  if (loading || !summary) return <p className="muted">Loading…</p>;

  const sorted = [...totals].sort((a, b) => b.totalCost - a.totalCost);

  return (
    <>
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
    </>
  );
}
