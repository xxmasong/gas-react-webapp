import type { InventoryItem } from '@shared/types';
import { formatCurrency, formatQty } from '../../../lib/format';
import { CostDisplay } from './CostDisplay';
import { MismatchBadge } from './MismatchBadge';
import { SaveStatusBadge } from './SaveStatusBadge';
import { useStockRow } from '../hooks/useStockRow';

export function InventoryCard({
  item,
  canEdit,
  onEdit,
  onDelete,
}: {
  item: InventoryItem;
  canEdit: boolean;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
}) {
  const s = useStockRow(item);

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
          <input type="number" inputMode="numeric" min={0} value={s.ground}
            className={s.dirty ? 'dirty' : ''}
            onChange={(e) => s.setGround(Number(e.target.value))} />
        </label>
        <label className="stock-field">
          <span>Upstairs</span>
          <input type="number" inputMode="numeric" min={0} value={s.upstair}
            className={s.dirty ? 'dirty' : ''}
            onChange={(e) => s.setUpstair(Number(e.target.value))} />
        </label>
        <label className="stock-field">
          <span>Box ×{item.uom}</span>
          <input type="number" inputMode="numeric" min={0} value={s.box}
            className={s.dirty ? 'dirty' : ''}
            onChange={(e) => s.setBox(Number(e.target.value))} />
        </label>
        <div className="stock-field total-field">
          <span>Total</span>
          <strong>{formatQty(s.liveTotal)}</strong>
        </div>
      </div>

      <div className="inv-card-statusline">
        <SaveStatusBadge status={s.status} />
      </div>

      <div className="inv-card-actions">
        <button
          className="primary save"
          disabled={!s.dirty || s.status === 'saving'}
          onClick={s.save}
        >
          {s.status === 'saving' ? 'Saving…' : 'Save'}
        </button>
        {canEdit && <button className="ghost" onClick={() => onEdit(item)}>Edit</button>}
        {canEdit && <button className="del" onClick={() => onDelete(item.id)}>Delete</button>}
      </div>
    </article>
  );
}
