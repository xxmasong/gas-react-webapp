import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie, Legend,
  AreaChart, Area, ReferenceLine,
} from 'recharts';
import { formatCurrency, formatQty } from '../../../lib/format';
import { useChartTheme } from '../lib/chartColors';
import type { CategoryDatum, StoreDatum, TopSkuDatum, AbcResult, StockHealthDatum } from '../lib/analytics';

const HEALTH_COLORS: Record<string, keyof ReturnType<typeof useChartTheme>> = {
  ok: 'success', low: 'warn', out: 'danger',
};

function tooltipStyle(t: ReturnType<typeof useChartTheme>) {
  return {
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    color: t.text,
    fontSize: 12,
  };
}

// Truncate long SKU labels on axes.
const short = (s: string, n = 16) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function ValueByCategoryChart({ data }: { data: CategoryDatum[] }) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 30 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={t.grid} />
        <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fill: t.muted, fontSize: 11 }} />
        <YAxis
          type="category" dataKey="name" width={110}
          tick={{ fill: t.muted, fontSize: 11 }}
          tickFormatter={(s: string) => short(s)}
        />
        <Tooltip
          contentStyle={tooltipStyle(t)}
          formatter={(v, _n, p) => {
            const d = p?.payload as CategoryDatum;
            return [`${formatCurrency(Number(v))} · ${formatQty(d.qty)} pcs`, d.name];
          }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => <Cell key={d.id} fill={t.palette[i % t.palette.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StoreSplitChart({ data }: { data: StoreDatum[] }) {
  const t = useChartTheme();
  const colorFor = (store: string) =>
    store === 'EASY' ? t.palette[1] : store === 'GRUTON' ? t.palette[2] : t.palette[3];
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data} dataKey="value" nameKey="store"
          cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}
        >
          {data.map((d) => <Cell key={d.store} fill={colorFor(d.store)} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle(t)} formatter={(v) => formatCurrency(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12, color: t.muted }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function StockHealthChart({ data }: { data: StockHealthDatum[] }) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} paddingAngle={2}>
          {data.map((d) => <Cell key={d.key} fill={t[HEALTH_COLORS[d.key]] as string} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle(t)} formatter={(v) => `${Number(v)} SKUs`} />
        <Legend wrapperStyle={{ fontSize: 12, color: t.muted }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TopSkusChart({ data }: { data: TopSkuDatum[] }) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 32 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={t.grid} />
        <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fill: t.muted, fontSize: 11 }} />
        <YAxis
          type="category" dataKey="sku" width={130}
          tick={{ fill: t.muted, fontSize: 11 }}
          tickFormatter={(s: string) => short(s, 18)}
        />
        <Tooltip
          contentStyle={tooltipStyle(t)}
          formatter={(v, _n, p) => {
            const d = p?.payload as TopSkuDatum;
            return [`${formatCurrency(Number(v))} · ${formatQty(d.qty)} pcs`, d.sku];
          }}
        />
        <Bar dataKey="value" fill={t.accent} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AbcCurveChart({ abc }: { abc: AbcResult }) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={abc.curve} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="abcFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.accent} stopOpacity={0.35} />
            <stop offset="100%" stopColor={t.accent} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={t.grid} />
        <XAxis
          dataKey="skuPct" type="number" domain={[0, 100]}
          tickFormatter={(v) => `${v}%`} tick={{ fill: t.muted, fontSize: 11 }}
          label={{ value: '% of SKUs', position: 'insideBottom', offset: -2, fill: t.muted, fontSize: 11 }}
        />
        <YAxis
          domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: t.muted, fontSize: 11 }}
          label={{ value: '% of value', angle: -90, position: 'insideLeft', fill: t.muted, fontSize: 11 }}
        />
        <Tooltip
          contentStyle={tooltipStyle(t)}
          formatter={(v) => [`${Number(v)}% of value`, 'Cumulative']}
          labelFormatter={(l) => `Top ${l}% of SKUs`}
        />
        <ReferenceLine y={80} stroke={t.warn} strokeDasharray="4 4" />
        <Area type="monotone" dataKey="cumulativePct" stroke={t.accent} strokeWidth={2} fill="url(#abcFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
