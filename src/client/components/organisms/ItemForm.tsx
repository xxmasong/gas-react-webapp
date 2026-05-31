import React, { useState } from 'react';
import type { InventoryItem, NewInventoryItem, SkuCategory } from '@shared/types';
import { formatCurrency } from '../../lib/format';
import { Spinner } from '../atoms';

type Editable = NewInventoryItem & { id?: string };

const BLANK: Editable = {
  categoryId: '', store: 'EASY', sku: '', emoji: '', uom: 1,
  costPerBoxNew: 0, costPerPieceNew: 0, costPerPieceOld: 0,
  sellingPriceWholesale: 0, sellingPriceDealer: 0, sellingPricePiece: 0, srp: 0,
  qtyGround: 0, expiryGround: '', qtyUpstair: 0, expiryUpstair: '', qtyBox: 0, expiryBox: '',
  qtyKyte: 0,
};

const fromItem = (item: InventoryItem): Editable => {
  const { updatedAt: _u, qtyTotal: _q, kyteMatch: _k, costTotal: _c, ...rest } = item;
  return rest;
};

const QTY_FIELDS: Array<{ key: keyof Editable; label: string }> = [
  { key: 'uom', label: 'UOM (per box)' },
  { key: 'qtyGround', label: 'Qty ground' },
  { key: 'qtyUpstair', label: 'Qty upstairs' },
  { key: 'qtyBox', label: 'Qty box' },
  { key: 'qtyKyte', label: 'Kyte qty' },
];

const EXPIRY_FIELDS: Array<{ key: keyof Editable; label: string }> = [
  { key: 'expiryGround', label: 'Expiry ground' },
  { key: 'expiryUpstair', label: 'Expiry upstairs' },
  { key: 'expiryBox', label: 'Expiry box' },
];

type Props = {
  categories: SkuCategory[];
  initial?: InventoryItem;
  onSubmit: (item: Editable) => Promise<void>;
  onCancel: () => void;
};

export const ItemForm: React.FC<Props> = ({ categories, initial, onSubmit, onCancel }) => {
  const [form, setForm] = useState<Editable>(
    initial ? fromItem(initial) : { ...BLANK, categoryId: categories[0]?.id ?? '' },
  );
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof Editable>(key: K, value: Editable[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku.trim() || !form.categoryId || form.uom <= 0) return;
    setBusy(true);
    try {
      await onSubmit(form);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Edit SKU' : 'Add SKU'}</h2>
        <form className="item-form" onSubmit={submit}>
          <label className="wide">
            <span>SKU name</span>
            <input value={form.sku} onChange={(e) => set('sku', e.target.value)} autoFocus />
          </label>
          <label>
            <span>Emoji</span>
            <input value={form.emoji} onChange={(e) => set('emoji', e.target.value)} />
          </label>
          <label>
            <span>Category</span>
            <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Store</span>
            <select value={form.store} onChange={(e) => set('store', e.target.value as Editable['store'])}>
              <option value="EASY">EASY</option>
              <option value="GRUTON">GRUTON</option>
            </select>
          </label>

          {QTY_FIELDS.map(({ key, label }) => (
            <label key={key}>
              <span>{label}</span>
              <input
                type="number"
                step="any"
                min={0}
                value={form[key] as number}
                onChange={(e) => set(key, Number(e.target.value) as Editable[typeof key])}
              />
            </label>
          ))}

          {EXPIRY_FIELDS.map(({ key, label }) => (
            <label key={key}>
              <span>{label}</span>
              <input
                type="date"
                value={form[key] as string}
                onChange={(e) => set(key, e.target.value as Editable[typeof key])}
              />
            </label>
          ))}

          {initial && (
            <fieldset className="readonly-prices">
              <legend>Prices & costs (read-only)</legend>
              <dl>
                <div><dt>Cost / pc (new)</dt><dd>{formatCurrency(form.costPerPieceNew)}</dd></div>
                <div><dt>Cost / pc (old)</dt><dd>{formatCurrency(form.costPerPieceOld)}</dd></div>
                <div><dt>Wholesale</dt><dd>{formatCurrency(form.sellingPriceWholesale)}</dd></div>
                <div><dt>Dealer</dt><dd>{formatCurrency(form.sellingPriceDealer)}</dd></div>
                <div><dt>Piece</dt><dd>{formatCurrency(form.sellingPricePiece)}</dd></div>
                <div><dt>SRP</dt><dd>{formatCurrency(form.srp)}</dd></div>
              </dl>
            </fieldset>
          )}

          <div className="modal-actions">
            <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
            <button type="submit" disabled={busy}>
              {busy && <Spinner size={14} />}
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
