import { useMemo, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  flexRender,
} from '@tanstack/react-table';
import type { InventoryItem } from '@shared/types';
import { formatCurrency, formatQty } from '../../../lib/format';
import { queryKeys } from '../../../lib/queryKeys';
import { useInventoryItems } from '../hooks/useInventoryItems';
import { inventoryColumns } from './inventoryColumns';
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

  // Sort by category name so groups appear alphabetically
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => catName(a.categoryId).localeCompare(catName(b.categoryId))),
    [filtered, catName],
  );

  async function onSaveStock(id: string, qtyGround: number, qtyUpstair: number, qtyBox: number) {
    try {
      setLocalError(null);
      await bulkUpdateStock([{ id, qtyGround, qtyUpstair, qtyBox }]);
    } catch (e) { setLocalError(String(e)); }
  }

  async function onDelete(id: string) {
    try {
      setLocalError(null);
      await remove(id);
    } catch (e) { setLocalError(String(e)); }
  }

  async function onFormSubmit(value: Parameters<typeof add>[0] & { id?: string }) {
    try {
      setLocalError(null);
      if (form?.mode === 'edit') await update({ ...form.item, ...value });
      else await add(value);
      setForm(null);
    } catch (e) { setLocalError(String(e)); }
  }

  const table = useReactTable({
    data: sorted,
    columns: inventoryColumns,
    state: { grouping: ['categoryId'], expanded: true },
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    // Keep all groups expanded by default
    autoResetExpanded: false,
  });

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
      ) : sorted.length === 0 ? (
        <p className="muted">No SKUs match.</p>
      ) : (
        <table className="grid inventory">
          <colgroup>
            {table.getFlatHeaders().map((header) => {
              const hidden = (header.column.columnDef.meta as any)?.hidden;
              if (hidden) return null;
              return (
                <col
                  key={header.id}
                  style={{
                    width: header.column.columnDef.size === 999
                      ? undefined
                      : header.column.columnDef.size,
                  }}
                />
              );
            })}
          </colgroup>

          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const hidden = (header.column.columnDef.meta as any)?.hidden;
                  if (hidden) return null;
                  const align = (header.column.columnDef.meta as any)?.align;
                  return (
                    <th
                      key={header.id}
                      className={align === 'right' ? 'num' : undefined}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row) => {
              if (row.getIsGrouped()) {
                const catId = row.getValue<string>('categoryId');
                const leafRows = row.getLeafRows();
                const cost = leafRows.reduce((s, r) => s + r.original.costTotal, 0);
                const qty  = leafRows.reduce((s, r) => s + r.original.qtyTotal, 0);
                // Count visible columns (excluding hidden)
                const visibleCols = table.getFlatHeaders().filter(
                  (h) => !(h.column.columnDef.meta as any)?.hidden,
                ).length;
                return (
                  <tr key={row.id} className="cat-group-row">
                    <td colSpan={Math.ceil(visibleCols / 2)} className="cat-group-name">
                      {catName(catId)}
                    </td>
                    <td colSpan={visibleCols - Math.ceil(visibleCols / 2)} className="cat-group-totals">
                      {formatCurrency(cost)} · {formatQty(qty)} pcs
                    </td>
                  </tr>
                );
              }

              return (
                <InventoryRow
                  key={row.id}
                  row={row}
                  onSaveStock={onSaveStock}
                  onEdit={(it) => setForm({ mode: 'edit', item: it })}
                  onDelete={onDelete}
                />
              );
            })}
          </tbody>
        </table>
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
