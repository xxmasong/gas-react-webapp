import React, { useCallback, useMemo } from 'react';
import type { Table } from '@tanstack/react-table';
import type { InventoryItem, SkuCategory } from '@shared/types';
import { STORES } from '../../config';
import { ColumnVisibilityMenu } from '../molecules';

type Props = {
  table: Table<InventoryItem>;
  categories: SkuCategory[];
  globalFilter: string;
  mismatchOnly: boolean;
  isFetching: boolean;
  canEditSku: boolean;
  onGlobalFilterChange: (v: string) => void;
  onMismatchOnlyChange: (v: boolean) => void;
  onAddSku: () => void;
};

export const InventoryToolbar: React.FC<Props> = ({
  table, categories, globalFilter, mismatchOnly, isFetching,
  canEditSku, onGlobalFilterChange, onMismatchOnlyChange, onAddSku,
}) => {
  const storeFilter    = useMemo(
    () => (table.getColumn('store')?.getFilterValue() as string) ?? '',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table.getState().columnFilters],
  );
  const categoryFilter = useMemo(
    () => (table.getColumn('categoryId')?.getFilterValue() as string) ?? '',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table.getState().columnFilters],
  );

  const onSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onGlobalFilterChange(e.target.value),
    [onGlobalFilterChange],
  );
  const onCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      table.getColumn('categoryId')?.setFilterValue(e.target.value || undefined),
    [table],
  );
  const onStoreChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      table.getColumn('store')?.setFilterValue(e.target.value || undefined),
    [table],
  );
  const onMismatchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onMismatchOnlyChange(e.target.checked),
    [onMismatchOnlyChange],
  );

  return (
    <div className="toolbar">
      <input
        className="search"
        placeholder="Search SKU…"
        value={globalFilter}
        onChange={onSearchChange}
      />
      <select value={categoryFilter} onChange={onCategoryChange}>
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <select value={storeFilter} onChange={onStoreChange}>
        <option value="">All stores</option>
        {STORES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={mismatchOnly}
          onChange={onMismatchChange}
        />
        Mismatches only
      </label>
      <ColumnVisibilityMenu table={table} />
      {canEditSku && (
        <button
          className="primary"
          disabled={categories.length === 0}
          onClick={onAddSku}
        >
          + Add SKU
        </button>
      )}
      {isFetching && <span className="fetching-badge">Refreshing…</span>}
    </div>
  );
};
