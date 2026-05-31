import type { InventoryItem, SkuCategory } from '@shared/types';

// A SKU at or below this on-hand piece count (but > 0) is "low stock".
export const LOW_STOCK_THRESHOLD = 5;

export type StockStatus = 'out' | 'low' | 'ok';

export function stockStatus(item: InventoryItem): StockStatus {
  if (item.qtyTotal <= 0) return 'out';
  if (item.qtyTotal <= LOW_STOCK_THRESHOLD) return 'low';
  return 'ok';
}

export type Kpis = {
  totalValue: number;
  totalQty: number;
  skuCount: number;
  categoryCount: number;
  outOfStock: number;
  lowStock: number;
  inStock: number;
  mismatches: number;
  /** SKUs carrying cost value but zero on-hand quantity. */
  deadStock: number;
  /** Kyte reconciliation accuracy as a 0–100 percentage. */
  kyteAccuracy: number;
};

export function computeKpis(items: InventoryItem[], categoryCount: number): Kpis {
  let totalValue = 0, totalQty = 0, out = 0, low = 0, ok = 0, mismatches = 0, dead = 0;
  let kyteTracked = 0, kyteMatched = 0;

  for (const it of items) {
    totalValue += it.costTotal || 0;
    totalQty += it.qtyTotal || 0;
    const s = stockStatus(it);
    if (s === 'out') out++; else if (s === 'low') low++; else ok++;
    if (!it.kyteMatch) mismatches++;
    if (it.qtyTotal <= 0 && (it.costPerPieceNew > 0 || it.costPerPieceOld > 0)) dead++;
    if (it.qtyKyte > 0) { kyteTracked++; if (it.kyteMatch) kyteMatched++; }
  }

  return {
    totalValue, totalQty,
    skuCount: items.length,
    categoryCount,
    outOfStock: out,
    lowStock: low,
    inStock: ok,
    mismatches,
    deadStock: dead,
    kyteAccuracy: kyteTracked === 0 ? 100 : Math.round((kyteMatched / kyteTracked) * 100),
  };
}

export type CategoryDatum = {
  id: string;
  name: string;
  value: number;
  qty: number;
  skuCount: number;
};

export function valueByCategory(items: InventoryItem[], categories: SkuCategory[]): CategoryDatum[] {
  const nameOf = new Map(categories.map((c) => [c.id, c.name]));
  const byCat = new Map<string, CategoryDatum>();
  for (const it of items) {
    const id = it.categoryId;
    const d = byCat.get(id) ?? {
      id, name: nameOf.get(id) ?? 'Uncategorized', value: 0, qty: 0, skuCount: 0,
    };
    d.value += it.costTotal || 0;
    d.qty += it.qtyTotal || 0;
    d.skuCount += 1;
    byCat.set(id, d);
  }
  return [...byCat.values()].sort((a, b) => b.value - a.value);
}

export type StoreDatum = {
  store: string;
  value: number;
  qty: number;
  skuCount: number;
};

export function valueByStore(items: InventoryItem[]): StoreDatum[] {
  const byStore = new Map<string, StoreDatum>();
  for (const it of items) {
    const d = byStore.get(it.store) ?? { store: it.store, value: 0, qty: 0, skuCount: 0 };
    d.value += it.costTotal || 0;
    d.qty += it.qtyTotal || 0;
    d.skuCount += 1;
    byStore.set(it.store, d);
  }
  return [...byStore.values()].sort((a, b) => b.value - a.value);
}

export type TopSkuDatum = {
  id: string;
  sku: string;
  value: number;
  qty: number;
};

export function topSkusByValue(items: InventoryItem[], n = 10): TopSkuDatum[] {
  return [...items]
    .map((it) => ({ id: it.id, sku: it.sku, value: it.costTotal || 0, qty: it.qtyTotal || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

export type AbcDatum = {
  /** 1-based rank of the SKU by descending value. */
  rank: number;
  /** Cumulative share of total value at this rank, 0–100. */
  cumulativePct: number;
  /** Cumulative share of SKU count at this rank, 0–100. */
  skuPct: number;
  class: 'A' | 'B' | 'C';
};

export type AbcResult = {
  curve: AbcDatum[];
  counts: { A: number; B: number; C: number };
};

// ABC analysis: rank SKUs by value, walk the cumulative curve. Class A = SKUs
// making up the first 80% of value, B = next 15%, C = last 5%.
export function abcAnalysis(items: InventoryItem[]): AbcResult {
  const valued = items
    .map((it) => it.costTotal || 0)
    .filter((v) => v > 0)
    .sort((a, b) => b - a);

  const total = valued.reduce((s, v) => s + v, 0);
  const counts = { A: 0, B: 0, C: 0 };
  const curve: AbcDatum[] = [];
  if (total === 0) return { curve, counts };

  let cum = 0;
  valued.forEach((v, i) => {
    cum += v;
    const cumulativePct = (cum / total) * 100;
    const cls: 'A' | 'B' | 'C' =
      cumulativePct <= 80 ? 'A' : cumulativePct <= 95 ? 'B' : 'C';
    counts[cls]++;
    curve.push({
      rank: i + 1,
      cumulativePct: Math.round(cumulativePct * 10) / 10,
      skuPct: Math.round(((i + 1) / valued.length) * 1000) / 10,
      class: cls,
    });
  });
  return { curve, counts };
}

export type StockHealthDatum = {
  name: string;
  value: number;
  key: StockStatus;
};

export function stockHealth(kpis: Kpis): StockHealthDatum[] {
  return [
    { name: 'In stock', value: kpis.inStock, key: 'ok' },
    { name: 'Low stock', value: kpis.lowStock, key: 'low' },
    { name: 'Out of stock', value: kpis.outOfStock, key: 'out' },
  ];
}

/** SKUs needing attention: out of stock or low, sorted out-first then by value. */
export type AttentionRow = {
  id: string;
  sku: string;
  store: string;
  qtyTotal: number;
  status: StockStatus;
  value: number;
};

export function attentionList(items: InventoryItem[]): AttentionRow[] {
  return items
    .filter((it) => stockStatus(it) !== 'ok')
    .map((it) => ({
      id: it.id, sku: it.sku, store: it.store, qtyTotal: it.qtyTotal,
      status: stockStatus(it), value: it.costTotal || 0,
    }))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'out' ? -1 : 1;
      return b.value - a.value;
    });
}
