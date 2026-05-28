import type { useAnalytics } from '../hooks/useAnalytics';
import {
  ValueByCategoryChart, StoreSplitChart, StockHealthChart, TopSkusChart, AbcCurveChart,
} from './charts';

type Analytics = ReturnType<typeof useAnalytics>;

// All recharts-backed charts in one component so React.lazy can defer the
// heavy charting code until the Analytics tab is actually opened.
export default function AnalyticsCharts({ a }: { a: Analytics }) {
  return (
    <div className="chart-grid">
      <section className="chart-card chart-wide">
        <h3 className="chart-title">Inventory value by category</h3>
        <ValueByCategoryChart data={a.byCategory} />
      </section>

      <section className="chart-card">
        <h3 className="chart-title">Value by store</h3>
        <StoreSplitChart data={a.byStore} />
      </section>

      <section className="chart-card">
        <h3 className="chart-title">Stock health</h3>
        <StockHealthChart data={a.health} />
      </section>

      <section className="chart-card chart-wide">
        <h3 className="chart-title">Top SKUs by value</h3>
        <TopSkusChart data={a.topSkus} />
      </section>

      <section className="chart-card chart-wide">
        <div className="chart-head">
          <h3 className="chart-title">ABC analysis</h3>
          <div className="abc-pills">
            <span className="abc-pill abc-a">A: {a.abc.counts.A}</span>
            <span className="abc-pill abc-b">B: {a.abc.counts.B}</span>
            <span className="abc-pill abc-c">C: {a.abc.counts.C}</span>
          </div>
        </div>
        <AbcCurveChart abc={a.abc} />
        <p className="chart-note muted">
          Class A SKUs make up the first 80% of inventory value, B the next 15%, C the last 5%.
        </p>
      </section>
    </div>
  );
}
