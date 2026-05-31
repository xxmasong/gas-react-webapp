import React, { useMemo, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel, getGroupedRowModel, getExpandedRowModel,
  getSortedRowModel, getFilteredRowModel,
  type SortingState, type ColumnFiltersState, type VisibilityState,
} from '@tanstack/react-table';
import type { InventoryItem } from '@shared/types';
import { queryKeys, cleanError } from '../../lib';
import { useLayout, useAuth, useToast } from '../../providers';
import { useInventoryItems } from '../../features/inventory/hooks/useInventoryItems';
import { inventoryColumns } from '../../features/inventory/components/inventoryColumns';
import { InventoryToolbar, InventoryTable, InventoryCardList, ItemForm } from '../organisms';
import { AppShell } from '../templates';

type FormState = { mode: 'add' } | { mode: 'edit'; item: InventoryItem } | null;

export const InventoryPage: React.FC = () => {
  const { items, categories, loading, add, update, remove } = useInventoryItems();
  const [globalFilter,     setGlobalFilter]     = useState('');
  const [sorting,          setSorting]          = useState<SortingState>([]);
  const [columnFilters,    setColumnFilters]    = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [mismatchOnly,     setMismatchOnly]     = useState(false);
  const [form,             setForm]             = useState<FormState>(null);

  const isFetching  = useIsFetching({ queryKey: queryKeys.inventoryItems() });
  const { isMobile } = useLayout();
  const { canEditSku } = useAuth();
  const toast = useToast();

  const catName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string) => map.get(id) ?? 'Uncategorized';
  }, [categories]);

  const data = useMemo(() => {
    const base = mismatchOnly ? items.filter((i) => !i.kyteMatch) : items;
    return [...base].sort((a, b) => catName(a.categoryId).localeCompare(catName(b.categoryId)));
  }, [items, mismatchOnly, catName]);

  const table = useReactTable({
    data,
    columns: inventoryColumns,
    initialState: { grouping: ['categoryId'], expanded: true },
    state: { sorting, columnFilters, columnVisibility, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _id, value) =>
      row.original.sku.toLowerCase().includes(String(value).toLowerCase()),
    getCoreRowModel:     getCoreRowModel(),
    getGroupedRowModel:  getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel:   getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    autoResetExpanded: false,
  });

  const onDelete = async (id: string) => {
    const item = items.find((i) => i.id === id);
    try {
      await remove(id);
      toast.success(`SKU "${item?.sku ?? id}" deleted.`);
    } catch (e) {
      toast.error(`Failed to delete SKU: ${cleanError(e)}`);
    }
  };

  const onFormSubmit = async (value: Parameters<typeof add>[0] & { id?: string }) => {
    const isEdit = form?.mode === 'edit';
    try {
      if (isEdit) await update({ ...form!.item, ...value });
      else await add(value);
      toast.success(isEdit ? `SKU "${value.sku}" updated.` : `SKU "${value.sku}" added.`);
      setForm(null);
    } catch (e) {
      toast.error(`Failed to ${isEdit ? 'update' : 'add'} SKU: ${cleanError(e)}`);
    }
  };

  const sharedProps = {
    table,
    catName,
    canEditSku,
    onEdit: (it: InventoryItem) => setForm({ mode: 'edit', item: it }),
    onDelete,
  };

  return (
    <AppShell>
      <InventoryToolbar
        table={table}
        categories={categories}
        globalFilter={globalFilter}
        mismatchOnly={mismatchOnly}
        isFetching={isFetching > 0}
        canEditSku={canEditSku}
        onGlobalFilterChange={setGlobalFilter}
        onMismatchOnlyChange={setMismatchOnly}
        onAddSku={() => setForm({ mode: 'add' })}
      />

      {loading ? (
        <div className="skeleton-table">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton-row" />)}
        </div>
      ) : table.getRowModel().rows.length === 0 ? (
        <p className="muted">No SKUs match.</p>
      ) : isMobile ? (
        <InventoryCardList {...sharedProps} />
      ) : (
        <InventoryTable {...sharedProps} />
      )}

      {form && (
        <ItemForm
          categories={categories}
          initial={form.mode === 'edit' ? form.item : undefined}
          onSubmit={onFormSubmit}
          onCancel={() => setForm(null)}
        />
      )}
    </AppShell>
  );
};
