import React from 'react';
import { flexRender, type Row, type Cell } from '@tanstack/react-table';
import type { InventoryItem } from '@shared/types';
import { formatQty } from '../../lib/format';
import { useAuth } from '../../providers';
import { useStockRow } from '../../features/inventory/hooks/useStockRow';
import { Spinner } from '../atoms';
import { SaveStatusBadge } from '../molecules';

const STOCK_FIELDS = {
  qtyGround: 'qtyGround',
  qtyUpstair: 'qtyUpstair',
  qtyBox: 'qtyBox',
} as const;

type Props = {
  row: Row<InventoryItem>;
  canEdit: boolean;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
};

export const InventoryRow: React.FC<Props> = ({ row, canEdit, onEdit, onDelete }) => {
  const item = row.original;
  const s = useStockRow(item);
  const { isAdmin } = useAuth();

  const stockValue: Record<string, number> = { qtyGround: s.ground, qtyUpstair: s.upstair, qtyBox: s.box };
  const stockSetter: Record<string, (n: number) => void> = {
    qtyGround: s.setGround,
    qtyUpstair: s.setUpstair,
    qtyBox: s.setBox,
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') s.save();
  };

  const renderCell = (cell: Cell<InventoryItem, unknown>) => {
    if (cell.column.columnDef.meta?.hidden) return null;
    const id = cell.column.id;
    const align = cell.column.columnDef.meta?.align;
    const numClass = align === 'right' ? 'num' : '';

    if (id in STOCK_FIELDS) {
      return (
        <td key={cell.id} className="num">
          <input
            className={`stock-in ${s.dirty ? 'dirty' : ''}`.trim()}
            type="number"
            inputMode="numeric"
            min={0}
            value={stockValue[id]}
            onChange={(e) => stockSetter[id](Number(e.target.value))}
            onKeyDown={onKeyDown}
          />
        </td>
      );
    }

    if (id === 'actions') {
      return (
        <td key={cell.id} className="actions">
          {s.dirty && (
            <button className="save" disabled={s.status === 'saving'} onClick={s.save}>
              {s.status === 'saving' && <Spinner size={12} />}
              {s.status === 'saving' ? 'Saving' : 'Save'}
            </button>
          )}
          {!s.dirty && canEdit && <button onClick={() => onEdit(item)}>Edit</button>}
          {isAdmin && <button className="del" onClick={() => onDelete(item.id)}>×</button>}
        </td>
      );
    }

    if (id === 'qtyTotal') {
      return (
        <td key={cell.id} className="num total">
          {formatQty(s.liveTotal)}
          <SaveStatusBadge status={s.status} />
        </td>
      );
    }

    const extra = id === 'sku' ? 'sku' : '';
    return (
      <td key={cell.id} className={`${numClass} ${extra}`.trim() || undefined}>
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </td>
    );
  };

  return (
    <tr className={item.kyteMatch ? '' : 'row-mismatch'}>
      {row.getVisibleCells().map(renderCell)}
    </tr>
  );
};
