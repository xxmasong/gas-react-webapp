import React from 'react';
import type { Table } from '@tanstack/react-table';
import type { InventoryItem, SkuCategory } from '@shared/types';
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
  const storeFilter    = (table.getColumn('store')?.getFilterValue()      as string) ?? '';
  const categoryFilter = (table.getColumn('categoryId')?.getFilterValue() as string) ?? '';

  return (
    <div className="toolbar">
      <input
        className="search"
        placeholder="Search SKU…"
        value={globalFilter}
        onChange={(e) => onGlobalFilterChange(e.target.value)}
      />
      <select
        value={categoryFilter}
        onChange={(e) => table.getColumn('categoryId')?.setFilterValue(e.target.value || undefined)}
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
          onChange={(e) => onMismatchOnlyChange(e.target.checked)}
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
