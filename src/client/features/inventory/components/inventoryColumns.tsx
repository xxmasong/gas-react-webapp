import { createColumnHelper } from '@tanstack/react-table';
import type { InventoryItem } from '@shared/types';
import { formatCurrency, formatQty } from '../../../lib/format';
import { CostDisplay } from './CostDisplay';
import { MismatchBadge } from './MismatchBadge';

export type InventoryRowMeta = {
  onSaveStock: (id: string, g: number, u: number, b: number) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  catName: (id: string) => string;
};

const col = createColumnHelper<InventoryItem>();

export const inventoryColumns = [
  // Hidden grouping column — TanStack uses this to build group rows
  col.accessor('categoryId', {
    id: 'categoryId',
    header: '',
    enableGrouping: true,
    // Suppress rendering in data rows (only used for group headers)
    cell: () => null,
    meta: { hidden: true },
  }),

  col.accessor('sku', {
    id: 'sku',
    header: 'SKU',
    size: 999, // flex-grow via CSS
    cell: (info) => <span className="sku">{info.getValue()}</span>,
  }),

  col.accessor('store', {
    id: 'store',
    header: 'Store',
    size: 80,
    cell: (info) => (
      <span className={`store-badge store-${info.getValue().toLowerCase()}`}>
        {info.getValue()}
      </span>
    ),
  }),

  col.accessor('uom', {
    id: 'uom',
    header: 'UOM',
    size: 60,
    cell: (info) => <span className="uom-badge">{info.getValue()}</span>,
    meta: { align: 'right' },
  }),

  col.display({
    id: 'cost',
    header: 'Cost / pc',
    size: 120,
    cell: (info) => (
      <CostDisplay
        oldCost={info.row.original.costPerPieceOld}
        newCost={info.row.original.costPerPieceNew}
      />
    ),
  }),

  col.accessor('srp', {
    id: 'srp',
    header: 'SRP',
    size: 100,
    cell: (info) =>
      info.getValue() ? formatCurrency(info.getValue()) : <span className="muted">—</span>,
    meta: { align: 'right' },
  }),

  col.display({
    id: 'qtyGround',
    header: 'Ground',
    size: 80,
    meta: { align: 'right', isStockInput: true, stockField: 'qtyGround' },
    cell: () => null, // rendered by InventoryRow directly (needs local state)
  }),

  col.display({
    id: 'qtyUpstair',
    header: 'Upstairs',
    size: 80,
    meta: { align: 'right', isStockInput: true, stockField: 'qtyUpstair' },
    cell: () => null,
  }),

  col.display({
    id: 'qtyBox',
    header: 'Box',
    size: 80,
    meta: { align: 'right', isStockInput: true, stockField: 'qtyBox' },
    cell: () => null,
  }),

  col.display({
    id: 'qtyTotal',
    header: 'Total',
    size: 70,
    meta: { align: 'right' },
    cell: (info) => <strong>{formatQty(info.row.original.qtyTotal)}</strong>,
  }),

  col.display({
    id: 'kyte',
    header: 'Kyte',
    size: 70,
    meta: { align: 'right' },
    cell: (info) => (
      <MismatchBadge
        qtyTotal={info.row.original.qtyTotal}
        qtyKyte={info.row.original.qtyKyte}
        match={info.row.original.kyteMatch}
      />
    ),
  }),

  col.display({
    id: 'actions',
    header: '',
    size: 90,
    meta: { align: 'right' },
    cell: () => null, // rendered by InventoryRow directly
  }),
];
