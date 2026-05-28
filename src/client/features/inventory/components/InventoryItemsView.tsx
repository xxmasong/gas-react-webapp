import { useMemo, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import type { InventoryItem } from '@shared/types';
import { formatCurrency, formatQty } from '../../../lib/format';
import { queryKeys } from '../../../lib/queryKeys';
import { useInventoryItems } from '../hooks/useInventoryItems';
import { InventoryRow } from './InventoryRow';
import { ItemForm } from './ItemForm';

type FormState = { mode: 'add' } | { mode: 'edit'; item: InventoryItem } | null;

export function InventoryItemsView() {
  const { items, categories, loading, error, add, update, remove, bulkUpdateStock } =
    useInventoryItems();
  const [localError, setLocalError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [mismatchOnly, setMismatchOnly] = useState(false);
  const [form, setForm] = useState<FormState>(null);

  const isFetching = useIsFetching({ queryKey: queryKeys.inventoryItems() });
  const displayError = localError ?? error;

  const catName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string) => map.get(id) ?? 'Uncategorized';
  }, [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryFilter && i.categoryId !== categoryFilter) return false;
      if (storeFilter && i.store !== storeFilter) return false;
      if (mismatchOnly && i.kyteMatch) return false;
      if (q && !i.sku.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, categoryFilter, storeFilter, mismatchOnly]);

  const grouped = useMemo(() => {
    const byCat = new Map<string, InventoryItem[]>();
    for (const it of filtered) {
      const arr = byCat.get(it.categoryId) ?? [];
      arr.push(it);
      byCat.set(it.categoryId, arr);
    }
    return [...byCat.entries()].sort((a, b) => catName(a[0]).localeCompare(catName(b[0])));
  }, [filtered, catName]);

  async function onSaveStock(id: string, qtyGround: number, qtyUpstair: number, qtyBox: number) {
    try {
      setLocalError(null);
      await bulkUpdateStock([{ id, qtyGround, qtyUpstair, qtyBox }]);
    } catch (e) {
      setLocalError(String(e));
    }
  }

  async function onDelete(id: string) {
    try {
      setLocalError(null);
      await remove(id);
    } catch (e) {
      setLocalError(String(e));
    }
  }

  async function onFormSubmit(value: Parameters<typeof add>[0] & { id?: string }) {
    try {
      setLocalError(null);
      if (form?.mode === 'edit') {
        await update({ ...form.item, ...value });
      } else {
        await add(value);
      }
      setForm(null);
    } catch (e) {
      setLocalError(String(e));
    }
  }

  return (
    <>
      {displayError && <div className="error">{displayError}</div>}

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
          <option value="">All stores</option>
          <option value="EASY">EASY</option>
          <option value="GRUTON">GRUTON</option>
        </select>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={mismatchOnly}
            onChange={(e) => setMismatchOnly(e.target.checked)}
          />
          Mismatches only
        </label>
        <button
          className="primary"
          disabled={categories.length === 0}
          onClick={() => setForm({ mode: 'add' })}
        >
          + Add SKU
        </button>
        {isFetching > 0 && <span className="fetching-badge">Refreshing…</span>}
      </div>

      {loading ? (
        <div className="skeleton-table">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton-row" />)}
        </div>
      ) : grouped.length === 0 ? (
        <p className="muted">No SKUs match.</p>
      ) : (
        grouped.map(([catId, rows]) => {
          const cost = rows.reduce((s, i) => s + i.costTotal, 0);
          const qty = rows.reduce((s, i) => s + i.qtyTotal, 0);
          return (
            <section key={catId} className="cat-group">
              <header className="cat-header">
                <h3>{catName(catId)}</h3>
                <span className="cat-totals">
                  {formatCurrency(cost)} · {formatQty(qty)} pcs
                </span>
              </header>
              <table className="grid inventory">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Store</th>
                    <th className="num">UOM</th>
                    <th>Cost / pc</th>
                    <th className="num">SRP</th>
                    <th className="num">Ground</th>
                    <th className="num">Upstairs</th>
                    <th className="num">Box</th>
                    <th className="num">Total</th>
                    <th className="num">Kyte</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <InventoryRow
                      key={item.id}
                      item={item}
                      onSaveStock={onSaveStock}
                      onEdit={(it) => setForm({ mode: 'edit', item: it })}
                      onDelete={onDelete}
                    />
                  ))}
                </tbody>
              </table>
            </section>
          );
        })
      )}

      {form && (
        <ItemForm
          categories={categories}
          initial={form.mode === 'edit' ? form.item : undefined}
          onSubmit={onFormSubmit}
          onCancel={() => setForm(null)}
        />
      )}
    </>
  );
}
