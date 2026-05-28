import { useState } from 'react';
import type { InventoryItem } from '@shared/types';
import { formatCurrency, formatQty } from '../../../lib/format';
import { CostDisplay } from './CostDisplay';
import { MismatchBadge } from './MismatchBadge';

export function InventoryCard({
  item,
  onSaveStock,
  onEdit,
  onDelete,
}: {
  item: InventoryItem;
  onSaveStock: (id: string, qtyGround: number, qtyUpstair: number, qtyBox: number) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
}) {
  const [ground, setGround] = useState(item.qtyGround);
  const [upstair, setUpstair] = useState(item.qtyUpstair);
  const [box, setBox] = useState(item.qtyBox);

  const dirty = ground !== item.qtyGround || upstair !== item.qtyUpstair || box !== item.qtyBox;
  const liveTotal = ground + upstair + box * item.uom;

  function commit() {
    if (dirty) onSaveStock(item.id, ground, upstair, box);
  }

  return (
    <article className={`inv-card ${item.kyteMatch ? '' : 'inv-card-mismatch'}`}>
      <div className="inv-card-top">
        <span className="inv-card-name">{item.sku}</span>
        <span className={`store-badge store-${item.store.toLowerCase()}`}>{item.store}</span>
      </div>

      <div className="inv-card-meta">
        <span className="inv-card-cost">
          <CostDisplay oldCost={item.costPerPieceOld} newCost={item.costPerPieceNew} />
        </span>
        {item.srp > 0 && <span className="inv-card-srp">SRP {formatCurrency(item.srp)}</span>}
        <span className="inv-card-kyte">
          <MismatchBadge qtyTotal={item.qtyTotal} qtyKyte={item.qtyKyte} match={item.kyteMatch} />
        </span>
      </div>

      <div className="inv-card-stock">
        <label className="stock-field">
          <span>Ground</span>
          <input type="number" inputMode="numeric" min={0} value={ground}
            onChange={(e) => setGround(Number(e.target.value))} onBlur={commit} />
        </label>
        <label className="stock-field">
          <span>Upstairs</span>
          <input type="number" inputMode="numeric" min={0} value={upstair}
            onChange={(e) => setUpstair(Number(e.target.value))} onBlur={commit} />
        </label>
        <label className="stock-field">
          <span>Box ×{item.uom}</span>
          <input type="number" inputMode="numeric" min={0} value={box}
            onChange={(e) => setBox(Number(e.target.value))} onBlur={commit} />
        </label>
        <div className="stock-field total-field">
          <span>Total</span>
          <strong>{formatQty(liveTotal)}</strong>
        </div>
      </div>

      <div className="inv-card-actions">
        <button className="ghost" onClick={() => onEdit(item)}>Edit</button>
        <button className="del" onClick={() => onDelete(item.id)}>Delete</button>
      </div>
    </article>
  );
}
