import React, { useCallback, useState } from 'react';
import type { InventoryItem, NewInventoryItem, SkuCategory } from '@shared/types';
import { formatCurrency } from '../../lib/format';
import { STORES, QTY_FIELDS, EXPIRY_FIELDS, DEFAULT_STORE } from '../../config';
import { Spinner } from '../atoms';

type Editable = NewInventoryItem & { id?: string };

const BLANK: Editable = {
  categoryId: '', store: DEFAULT_STORE as Editable['store'], sku: '', emoji: '', uom: 1,
  costPerBoxNew: 0, costPerPieceNew: 0, costPerPieceOld: 0,
  sellingPriceWholesale: 0, sellingPriceDealer: 0, sellingPricePiece: 0, srp: 0,
  qtyGround: 0, expiryGround: '', qtyUpstair: 0, expiryUpstair: '', qtyBox: 0, expiryBox: '',
  qtyKyte: 0,
};

const fromItem = (item: InventoryItem): Editable => {
  const { updatedAt: _u, qtyTotal: _q, kyteMatch: _k, costTotal: _c, ...rest } = item;
  return rest;
};

type Props = {
  categories: SkuCategory[];
  initial?: InventoryItem;
  onSubmit: (item: Editable) => Promise<void>;
  onCancel: () => void;
};

export const ItemForm: React.FC<Props> = ({ categories, initial, onSubmit, onCancel }) => {
  const [form, setForm] = useState<Editable>(() =>
    initial ? fromItem(initial) : { ...BLANK, categoryId: categories[0]?.id ?? '' },
  );
  const [busy, setBusy] = useState(false);

  const set = useCallback(<K extends keyof Editable>(key: K, value: Editable[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku.trim() || !form.categoryId || form.uom <= 0) return;
    setBusy(true);
    try {
      await onSubmit(form);
    } finally {
      setBusy(false);
    }
  }, [form, onSubmit]);

  const onSkuChange      = useCallback((e: React.ChangeEvent<HTMLInputElement>)  => set('sku', e.target.value), [set]);
  const onEmojiChange    = useCallback((e: React.ChangeEvent<HTMLInputElement>)  => set('emoji', e.target.value), [set]);
  const onCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => set('categoryId', e.target.value), [set]);
  const onStoreChange    = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => set('store', e.target.value as Editable['store']), [set]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Edit SKU' : 'Add SKU'}</h2>
        <form className="item-form" onSubmit={submit}>
          <label className="wide">
            <span>SKU name</span>
            <input value={form.sku} onChange={onSkuChange} autoFocus />
          </label>
          <label>
            <span>Emoji</span>
            <input value={form.emoji} onChange={onEmojiChange} />
          </label>
          <label>
            <span>Category</span>
            <select value={form.categoryId} onChange={onCategoryChange}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Store</span>
            <select value={form.store} onChange={onStoreChange}>
              {STORES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>

          {QTY_FIELDS.map(({ key, label }) => (
            <label key={key}>
              <span>{label}</span>
              <input
                type="number"
                step="any"
                min={0}
                value={form[key as keyof Editable] as number}
                onChange={(e) => set(key as keyof Editable, Number(e.target.value) as Editable[keyof Editable])}
              />
            </label>
          ))}

          {EXPIRY_FIELDS.map(({ key, label }) => (
            <label key={key}>
              <span>{label}</span>
              <input
                type="date"
                value={form[key as keyof Editable] as string}
                onChange={(e) => set(key as keyof Editable, e.target.value as Editable[keyof Editable])}
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
