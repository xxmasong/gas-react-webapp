import { flexRender, type Row, type Cell } from '@tanstack/react-table';
import type { InventoryItem } from '@shared/types';
import { formatQty } from '../../../lib/format';
import { useStockRow } from '../hooks/useStockRow';
import { SaveStatusBadge } from './SaveStatusBadge';

const STOCK_FIELDS = {
  qtyGround: 'qtyGround',
  qtyUpstair: 'qtyUpstair',
  qtyBox: 'qtyBox',
} as const;

export function InventoryRow({
  row,
  onEdit,
  onDelete,
}: {
  row: Row<InventoryItem>;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
}) {
  const item = row.original;
  const s = useStockRow(item);

  const stockValue: Record<string, number> = { qtyGround: s.ground, qtyUpstair: s.upstair, qtyBox: s.box };
  const stockSetter: Record<string, (n: number) => void> = {
    qtyGround: s.setGround,
    qtyUpstair: s.setUpstair,
    qtyBox: s.setBox,
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') s.save();
  }

  function renderCell(cell: Cell<InventoryItem, unknown>) {
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
          <button
            className="save"
            disabled={!s.dirty || s.status === 'saving'}
            onClick={s.save}
            title={s.dirty ? 'Save stock changes' : 'No changes to save'}
          >
            {s.status === 'saving' ? '…' : 'Save'}
          </button>
          <button onClick={() => onEdit(item)}>Edit</button>
          <button className="del" onClick={() => onDelete(item.id)}>×</button>
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
  }

  return (
    <tr className={item.kyteMatch ? '' : 'row-mismatch'}>
      {row.getVisibleCells().map(renderCell)}
    </tr>
  );
}
