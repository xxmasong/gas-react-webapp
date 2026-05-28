import { useState } from 'react';
import type { Row } from '@tanstack/react-table';
import type { InventoryItem } from '@shared/types';
import { formatQty } from '../../../lib/format';
import { CostDisplay } from './CostDisplay';
import { MismatchBadge } from './MismatchBadge';

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
  const liveTotal = ground + upstair + box * item.uom;

  function commit() {
    if (dirty) onSaveStock(item.id, ground, upstair, box);
  }

  return (
    <tr className={item.kyteMatch ? '' : 'row-mismatch'}>
      <td className="sku">{item.sku}</td>
      <td>
        <span className={`store-badge store-${item.store.toLowerCase()}`}>{item.store}</span>
      </td>
      <td className="num">
        <span className="uom-badge">{item.uom}</span>
      </td>
      <td>
        <CostDisplay oldCost={item.costPerPieceOld} newCost={item.costPerPieceNew} />
      </td>
      <td className="num">
        {item.srp
          ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(item.srp)
          : <span className="muted">—</span>}
      </td>
      <td className="num">
        <input className="stock-in" type="number" min={0} value={ground}
          onChange={(e) => setGround(Number(e.target.value))} onBlur={commit} />
      </td>
      <td className="num">
        <input className="stock-in" type="number" min={0} value={upstair}
          onChange={(e) => setUpstair(Number(e.target.value))} onBlur={commit} />
      </td>
      <td className="num">
        <input className="stock-in" type="number" min={0} value={box}
          onChange={(e) => setBox(Number(e.target.value))} onBlur={commit} />
      </td>
      <td className="num total">{formatQty(liveTotal)}</td>
      <td className="num">
        <MismatchBadge qtyTotal={item.qtyTotal} qtyKyte={item.qtyKyte} match={item.kyteMatch} />
      </td>
      <td className="actions">
        <button onClick={() => onEdit(item)}>Edit</button>
        <button className="del" onClick={() => onDelete(item.id)}>×</button>
      </td>
    </tr>
  );
}
