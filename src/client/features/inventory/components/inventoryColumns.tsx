import { createColumnHelper } from '@tanstack/react-table';
import type { InventoryItem } from '@shared/types';
import { formatCurrency, formatQty } from '../../../lib/format';
import { COLUMN_CONFIGS } from '../../../config';
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

const cfg = (id: string) => COLUMN_CONFIGS.find((c) => c.id === id)!;

export const inventoryColumns = [
  col.accessor('categoryId', {
    id: 'categoryId',
    header: '',
    enableGrouping: true,
    enableHiding: false,
    filterFn: 'equals',
    cell: () => null,
    meta: { hidden: true, label: cfg('categoryId').label },
  }),

  col.accessor('sku', {
    id: 'sku',
    header: cfg('sku').header,
    size: cfg('sku').size,
    enableHiding: false,
    cell: (info) => <span className="sku">{info.getValue()}</span>,
    meta: { label: cfg('sku').label },
  }),

  col.accessor('store', {
    id: 'store',
    header: cfg('store').header,
    size: cfg('store').size,
    filterFn: 'equals',
    cell: (info) => <StoreBadge store={info.getValue()} />,
    meta: { label: cfg('store').label },
  }),

  col.accessor('uom', {
    id: 'uom',
    header: cfg('uom').header,
    size: cfg('uom').size,
    cell: (info) => <span className="uom-badge">{info.getValue()}</span>,
    meta: { align: 'right', label: cfg('uom').label },
  }),

  col.accessor('costPerPieceNew', {
    id: 'cost',
    header: cfg('cost').header,
    size: cfg('cost').size,
    cell: (info) => (
      <CostDisplay
        oldCost={info.row.original.costPerPieceOld}
        newCost={info.row.original.costPerPieceNew}
      />
    ),
    meta: { label: cfg('cost').label },
  }),

  col.accessor('srp', {
    id: 'srp',
    header: cfg('srp').header,
    size: cfg('srp').size,
    cell: (info) =>
      info.getValue() ? formatCurrency(info.getValue()) : <span className="muted">—</span>,
    meta: { align: 'right', label: cfg('srp').label },
  }),

  col.accessor('qtyGround', {
    id: 'qtyGround',
    header: cfg('qtyGround').header,
    size: cfg('qtyGround').size,
    cell: () => null,
    meta: { align: 'right', label: cfg('qtyGround').label },
  }),

  col.accessor('qtyUpstair', {
    id: 'qtyUpstair',
    header: cfg('qtyUpstair').header,
    size: cfg('qtyUpstair').size,
    cell: () => null,
    meta: { align: 'right', label: cfg('qtyUpstair').label },
  }),

  col.accessor('qtyBox', {
    id: 'qtyBox',
    header: cfg('qtyBox').header,
    size: cfg('qtyBox').size,
    cell: () => null,
    meta: { align: 'right', label: cfg('qtyBox').label },
  }),

  col.accessor('qtyTotal', {
    id: 'qtyTotal',
    header: cfg('qtyTotal').header,
    size: cfg('qtyTotal').size,
    cell: (info) => <strong>{formatQty(info.getValue())}</strong>,
    meta: { align: 'right', label: cfg('qtyTotal').label },
  }),

  col.accessor((r) => r.qtyTotal - r.qtyKyte, {
    id: 'kyte',
    header: cfg('kyte').header,
    size: cfg('kyte').size,
    cell: (info) => (
      <MismatchBadge
        qtyTotal={info.row.original.qtyTotal}
        qtyKyte={info.row.original.qtyKyte}
        match={info.row.original.kyteMatch}
      />
    ),
    meta: { align: 'right', label: cfg('kyte').label },
  }),

  col.display({
    id: 'actions',
    header: '',
    size: cfg('actions').size,
    enableSorting: false,
    enableHiding: false,
    cell: () => null,
    meta: { align: 'right', label: cfg('actions').label },
  }),
];
