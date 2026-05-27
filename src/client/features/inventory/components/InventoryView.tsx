import { useState } from 'react';
import type { Item } from '@shared/types';
import { useInventory } from '../hooks/useInventory';

export function InventoryView() {
  const { items, loading, error, setError, add, update, remove } = useInventory();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await add({ name: name.trim(), quantity });
      setName('');
      setQuantity(1);
    } catch (e) {
      setError(String(e));
    }
  }

  async function onDelete(id: string) {
    try {
      await remove(id);
    } catch (e) {
      setError(String(e));
    }
  }

  async function onChangeQty(item: Item, delta: number) {
    const next = { ...item, quantity: Math.max(0, item.quantity + delta) };
    // optimistic update
    try {
      await update(next);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <>
      {error && <div className="error">{error}</div>}

      <form className="add-form" onSubmit={onAdd}>
        <input
          placeholder="Item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          min={0}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
        <button type="submit">Add</button>
      </form>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="muted">No items yet. Add one above.</p>
      ) : (
        <ul className="items">
          {items.map((item) => (
            <li key={item.id}>
              <span className="item-name">{item.name}</span>
              <div className="qty">
                <button onClick={() => onChangeQty(item, -1)} aria-label="decrease">
                  −
                </button>
                <span>{item.quantity}</span>
                <button onClick={() => onChangeQty(item, +1)} aria-label="increase">
                  +
                </button>
              </div>
              <button className="del" onClick={() => onDelete(item.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
