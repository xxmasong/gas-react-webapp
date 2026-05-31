import React from 'react';
import type { InventoryItem } from '@shared/types';
import { formatCurrency, formatQty } from '../../lib/format';
import { useAuth } from '../../providers';
import { useStockRow } from '../../features/inventory/hooks/useStockRow';
import { Spinner, StoreBadge } from '../atoms';
import { CostDisplay, MismatchBadge, SaveStatusBadge } from '../molecules';

type Props = {
  item: InventoryItem;
  canEdit: boolean;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
};

export const InventoryCard: React.FC<Props> = ({ item, canEdit, onEdit, onDelete }) => {
  const s = useStockRow(item);
  const { isAdmin } = useAuth();

  return (
    <article className={`inv-card ${item.kyteMatch ? '' : 'inv-card-mismatch'}`}>
      <div className="inv-card-top">
        <span className="inv-card-name">{item.sku}</span>
        <StoreBadge store={item.store} />
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
        {s.dirty && (
          <button className="primary save" disabled={s.status === 'saving'} onClick={s.save}>
            {s.status === 'saving' && <Spinner size={14} />}
            {s.status === 'saving' ? 'Saving…' : 'Save'}
          </button>
        )}
        {!s.dirty && canEdit && <button className="ghost" onClick={() => onEdit(item)}>Edit</button>}
        {isAdmin && <button className="del" onClick={() => onDelete(item.id)}>Delete</button>}
      </div>
    </article>
  );
};
