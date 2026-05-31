import { createColumnHelper } from '@tanstack/react-table';
import type { InventoryItem } from '@shared/types';
import { formatCurrency, formatQty } from '../../../lib/format';
import { StoreBadge } from '../../../components/atoms';
import { CostDisplay, MismatchBadge } from '../../../components/molecules';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends unknown, TValue> {
    align?: 'right';
    hidden?: boolean;
    label?: string;
  }
}

const col = createColumnHelper<InventoryItem>();

export const inventoryColumns = [
  // Hidden grouping column — drives the group row model and the category filter.
  col.accessor('categoryId', {
    id: 'categoryId',
    header: '',
    enableGrouping: true,
    enableHiding: false,
    filterFn: 'equals',
    cell: () => null,
    meta: { hidden: true, label: 'Category' },
  }),

  col.accessor('sku', {
    id: 'sku',
    header: 'SKU',
    size: 999,
    enableHiding: false,
    cell: (info) => <span className="sku">{info.getValue()}</span>,
    meta: { label: 'SKU' },
  }),

  col.accessor('store', {
    id: 'store',
    header: 'Store',
    size: 80,
    filterFn: 'equals',
    cell: (info) => <StoreBadge store={info.getValue()} />,
    meta: { label: 'Store' },
  }),

  col.accessor('uom', {
    id: 'uom',
    header: 'UOM',
    size: 60,
    cell: (info) => <span className="uom-badge">{info.getValue()}</span>,
    meta: { align: 'right', label: 'UOM' },
  }),

  col.accessor('costPerPieceNew', {
    id: 'cost',
    header: 'Cost / pc',
    size: 120,
    cell: (info) => (
      <CostDisplay
        oldCost={info.row.original.costPerPieceOld}
        newCost={info.row.original.costPerPieceNew}
      />
    ),
    meta: { label: 'Cost / pc' },
  }),

  col.accessor('srp', {
    id: 'srp',
    header: 'SRP',
    size: 100,
    cell: (info) =>
      info.getValue() ? formatCurrency(info.getValue()) : <span className="muted">—</span>,
    meta: { align: 'right', label: 'SRP' },
  }),

  col.accessor('qtyGround', {
    id: 'qtyGround',
    header: 'Ground',
    size: 80,
    cell: () => null, // rendered by InventoryRow (needs local input state)
    meta: { align: 'right', label: 'Ground' },
  }),

  col.accessor('qtyUpstair', {
    id: 'qtyUpstair',
    header: 'Upstairs',
    size: 80,
    cell: () => null,
    meta: { align: 'right', label: 'Upstairs' },
  }),

  col.accessor('qtyBox', {
    id: 'qtyBox',
    header: 'Box',
    size: 80,
    cell: () => null,
    meta: { align: 'right', label: 'Box' },
  }),

  col.accessor('qtyTotal', {
    id: 'qtyTotal',
    header: 'Total',
    size: 70,
    cell: (info) => <strong>{formatQty(info.getValue())}</strong>,
    meta: { align: 'right', label: 'Total' },
  }),

  col.accessor((r) => r.qtyTotal - r.qtyKyte, {
    id: 'kyte',
    header: 'Kyte',
    size: 70,
    cell: (info) => (
      <MismatchBadge
        qtyTotal={info.row.original.qtyTotal}
        qtyKyte={info.row.original.qtyKyte}
        match={info.row.original.kyteMatch}
      />
    ),
    meta: { align: 'right', label: 'Kyte' },
  }),

  col.display({
    id: 'actions',
    header: '',
    size: 90,
    enableSorting: false,
    enableHiding: false,
    cell: () => null, // rendered by InventoryRow directly
    meta: { align: 'right', label: 'Actions' },
  }),
];
