import { useMemo, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from '@tanstack/react-table';
import type { InventoryItem } from '@shared/types';
import { formatCurrency, formatQty } from '../../../lib/format';
import { queryKeys } from '../../../lib/queryKeys';
import { useLayout } from '../../../providers';
import { useInventoryItems } from '../hooks/useInventoryItems';
import { inventoryColumns } from './inventoryColumns';
import { InventoryRow } from './InventoryRow';
import { InventoryCard } from './InventoryCard';
import { ColumnVisibilityMenu } from './ColumnVisibilityMenu';
import { ItemForm } from './ItemForm';

type FormState = { mode: 'add' } | { mode: 'edit'; item: InventoryItem } | null;

export function InventoryItemsView() {
  const { items, categories, loading, error, add, update, remove } = useInventoryItems();
  const [localError, setLocalError] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [mismatchOnly, setMismatchOnly] = useState(false);
  const [form, setForm] = useState<FormState>(null);

  const isFetching = useIsFetching({ queryKey: queryKeys.inventoryItems() });
  const displayError = localError ?? error;
  const { isMobile } = useLayout();

  const catName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string) => map.get(id) ?? 'Uncategorized';
  }, [categories]);

  // The "mismatches only" toggle is a cross-cutting predicate, so it stays as a
  // pre-filter. We also pre-sort by category name so the grouped rows appear
  // in alphabetical category order (the group row model preserves input order).
  const data = useMemo(() => {
    const base = mismatchOnly ? items.filter((i) => !i.kyteMatch) : items;
    return [...base].sort((a, b) => catName(a.categoryId).localeCompare(catName(b.categoryId)));
  }, [items, mismatchOnly, catName]);

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
    data,
    columns: inventoryColumns,
    // grouping + expanded are fixed (always grouped, always expanded), so they
    // live in initialState — NOT controlled state. Passing `expanded: true` as
    // controlled state with no onExpandedChange handler caused an infinite
    // render loop / white screen.
    initialState: { grouping: ['categoryId'], expanded: true },
    state: { sorting, columnFilters, columnVisibility, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    // Global search matches the SKU name only.
    globalFilterFn: (row, _id, value) =>
      row.original.sku.toLowerCase().includes(String(value).toLowerCase()),
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    autoResetExpanded: false,
  });

  const visibleLeafCount = table.getVisibleLeafColumns().filter(
    (c) => !c.columnDef.meta?.hidden,
  ).length;

  const storeFilter = (table.getColumn('store')?.getFilterValue() as string) ?? '';
  const categoryFilter = (table.getColumn('categoryId')?.getFilterValue() as string) ?? '';

  return (
    <>
      {displayError && <div className="error">{displayError}</div>}

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search SKU…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />
        <select
          value={categoryFilter}
          onChange={(e) =>
            table.getColumn('categoryId')?.setFilterValue(e.target.value || undefined)
          }
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={storeFilter}
          onChange={(e) => table.getColumn('store')?.setFilterValue(e.target.value || undefined)}
        >
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
        <ColumnVisibilityMenu table={table} />
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
      ) : table.getRowModel().rows.length === 0 ? (
        <p className="muted">No SKUs match.</p>
      ) : isMobile ? (
        <div className="inv-cards">
          {table.getRowModel().rows.map((row) => {
            if (row.getIsGrouped()) {
              const catId = row.getValue<string>('categoryId');
              const leafRows = row.getLeafRows();
              const cost = leafRows.reduce((s, r) => s + r.original.costTotal, 0);
              const qty = leafRows.reduce((s, r) => s + r.original.qtyTotal, 0);
              return (
                <div key={row.id} className="inv-cards-group-header">
                  <span className="inv-cards-group-name">{catName(catId)}</span>
                  <span className="inv-cards-group-totals">
                    {formatCurrency(cost)} · {formatQty(qty)} pcs
                  </span>
                </div>
              );
            }
            return (
              <InventoryCard
                key={row.id}
                item={row.original}
                onEdit={(it) => setForm({ mode: 'edit', item: it })}
                onDelete={onDelete}
              />
            );
          })}
        </div>
      ) : (
        <table className="grid inventory">
          <colgroup>
            {table.getVisibleLeafColumns().map((column) => {
              if (column.columnDef.meta?.hidden) return null;
              const size = column.columnDef.size;
              return <col key={column.id} style={{ width: size === 999 ? undefined : size }} />;
            })}
          </colgroup>

          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  if (header.column.columnDef.meta?.hidden) return null;
                  const align = header.column.columnDef.meta?.align;
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={`${align === 'right' ? 'num' : ''} ${canSort ? 'sortable' : ''}`.trim() || undefined}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className="sort-ind">
                          {sortDir === 'asc' ? ' ▲' : sortDir === 'desc' ? ' ▼' : ''}
                        </span>
                      )}
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
                const qty = leafRows.reduce((s, r) => s + r.original.qtyTotal, 0);
                const nameCols = Math.ceil(visibleLeafCount / 2);
                return (
                  <tr key={row.id} className="cat-group-row">
                    <td colSpan={nameCols} className="cat-group-name">{catName(catId)}</td>
                    <td colSpan={visibleLeafCount - nameCols} className="cat-group-totals">
                      {formatCurrency(cost)} · {formatQty(qty)} pcs
                    </td>
                  </tr>
                );
              }
              return (
                <InventoryRow
                  key={row.id}
                  row={row}
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
