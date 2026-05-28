import { useState } from 'react';
import { flexRender, type Row, type Cell } from '@tanstack/react-table';
import type { InventoryItem } from '@shared/types';

const STOCK_FIELDS = {
  qtyGround: 'qtyGround',
  qtyUpstair: 'qtyUpstair',
  qtyBox: 'qtyBox',
} as const;

export function InventoryRow({
  row,
  onSaveStock,
  onEdit,
  onDelete,
}: {
  row: Row<InventoryItem>;
  onSaveStock: (id: string, qtyGround: number, qtyUpstair: number, qtyBox: number) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
}) {
  const item = row.original;
  const [ground, setGround] = useState(item.qtyGround);
  const [upstair, setUpstair] = useState(item.qtyUpstair);
  const [box, setBox] = useState(item.qtyBox);

  const dirty = ground !== item.qtyGround || upstair !== item.qtyUpstair || box !== item.qtyBox;

  function commit() {
    if (dirty) onSaveStock(item.id, ground, upstair, box);
  }

  const stockValue: Record<string, number> = { qtyGround: ground, qtyUpstair: upstair, qtyBox: box };
  const stockSetter: Record<string, (n: number) => void> = {
    qtyGround: setGround,
    qtyUpstair: setUpstair,
    qtyBox: setBox,
  };

  function renderCell(cell: Cell<InventoryItem, unknown>) {
    if (cell.column.columnDef.meta?.hidden) return null;
    const id = cell.column.id;
    const align = cell.column.columnDef.meta?.align;
    const numClass = align === 'right' ? 'num' : '';

    // Stock inputs keep local state for the blur-to-save UX.
    if (id in STOCK_FIELDS) {
      return (
        <td key={cell.id} className="num">
          <input
            className="stock-in"
            type="number"
            min={0}
            value={stockValue[id]}
            onChange={(e) => stockSetter[id](Number(e.target.value))}
            onBlur={commit}
          />
        </td>
      );
    }

    if (id === 'actions') {
      return (
        <td key={cell.id} className="actions">
          <button onClick={() => onEdit(item)}>Edit</button>
          <button className="del" onClick={() => onDelete(item.id)}>×</button>
        </td>
      );
    }

    const extra = id === 'sku' ? 'sku' : id === 'qtyTotal' ? 'total' : '';
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
