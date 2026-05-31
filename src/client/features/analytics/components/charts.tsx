import React, { useCallback, useMemo } from 'react';
import { STORES } from '../../../config';
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

const short = (s: string, n = 16) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export const ValueByCategoryChart: React.FC<{ data: CategoryDatum[] }> = ({ data }) => {
  const t = useChartTheme();
  const tipStyle = useMemo(() => ({
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    color: t.text,
    fontSize: 12,
  }), [t.surface, t.border, t.text]);

  const formatter = useCallback((v: unknown, _n: unknown, p: { payload?: CategoryDatum }) => {
    const d = p?.payload as CategoryDatum;
    return [`${formatCurrency(Number(v))} · ${formatQty(d.qty)} pcs`, d.name];
  }, []);

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
        <Tooltip contentStyle={tipStyle} formatter={formatter} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => <Cell key={d.id} fill={t.palette[i % t.palette.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export const StoreSplitChart: React.FC<{ data: StoreDatum[] }> = ({ data }) => {
  const t = useChartTheme();
  const tipStyle = useMemo(() => ({
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    color: t.text,
    fontSize: 12,
  }), [t.surface, t.border, t.text]);

  const colorFor = useCallback((store: string) => {
    const idx = STORES.findIndex((s) => s.value === store);
    return t.palette[idx >= 0 ? idx + 1 : t.palette.length - 1];
  }, [t.palette]);

  const formatter = useCallback((v: unknown) => formatCurrency(Number(v)), []);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data} dataKey="value" nameKey="store"
          cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}
        >
          {data.map((d) => <Cell key={d.store} fill={colorFor(d.store)} />)}
        </Pie>
        <Tooltip contentStyle={tipStyle} formatter={formatter} />
        <Legend wrapperStyle={{ fontSize: 12, color: t.muted }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const StockHealthChart: React.FC<{ data: StockHealthDatum[] }> = ({ data }) => {
  const t = useChartTheme();
  const tipStyle = useMemo(() => ({
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    color: t.text,
    fontSize: 12,
  }), [t.surface, t.border, t.text]);

  const formatter = useCallback((v: unknown) => `${Number(v)} SKUs`, []);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} paddingAngle={2}>
          {data.map((d) => <Cell key={d.key} fill={t[HEALTH_COLORS[d.key]] as string} />)}
        </Pie>
        <Tooltip contentStyle={tipStyle} formatter={formatter} />
        <Legend wrapperStyle={{ fontSize: 12, color: t.muted }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const TopSkusChart: React.FC<{ data: TopSkuDatum[] }> = ({ data }) => {
  const t = useChartTheme();
  const tipStyle = useMemo(() => ({
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    color: t.text,
    fontSize: 12,
  }), [t.surface, t.border, t.text]);

  const formatter = useCallback((v: unknown, _n: unknown, p: { payload?: TopSkuDatum }) => {
    const d = p?.payload as TopSkuDatum;
    return [`${formatCurrency(Number(v))} · ${formatQty(d.qty)} pcs`, d.sku];
  }, []);

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
        <Tooltip contentStyle={tipStyle} formatter={formatter} />
        <Bar dataKey="value" fill={t.accent} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export const AbcCurveChart: React.FC<{ abc: AbcResult }> = ({ abc }) => {
  const t = useChartTheme();
  const tipStyle = useMemo(() => ({
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    color: t.text,
    fontSize: 12,
  }), [t.surface, t.border, t.text]);

  const formatter  = useCallback((v: unknown) => [`${Number(v)}% of value`, 'Cumulative'], []);
  const labelFormatter = useCallback((l: unknown) => `Top ${l}% of SKUs`, []);

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
        <Tooltip contentStyle={tipStyle} formatter={formatter} labelFormatter={labelFormatter} />
        <ReferenceLine y={80} stroke={t.warn} strokeDasharray="4 4" />
        <Area type="monotone" dataKey="cumulativePct" stroke={t.accent} strokeWidth={2} fill="url(#abcFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
};
