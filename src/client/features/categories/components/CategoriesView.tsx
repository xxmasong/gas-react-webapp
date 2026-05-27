import { useState } from 'react';
import type { SkuCategory } from '@shared/types';
import { useCategories } from '../hooks/useCategories';

const EMPTY = { code: '', name: '', packConstraint: '', sortOrder: 0 };

export function CategoriesView() {
  const { categories, loading, error, setError, add, update, remove } = useCategories();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  function startEdit(cat: SkuCategory) {
    setEditingId(cat.id);
    setForm({ code: cat.code, name: cat.name, packConstraint: cat.packConstraint, sortOrder: cat.sortOrder });
  }

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) return;
    try {
      if (editingId) {
        await update({ id: editingId, updatedAt: '', ...form });
      } else {
        await add(form);
      }
      reset();
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

  return (
    <>
      {error && <div className="error">{error}</div>}

      <form className="cat-form" onSubmit={onSubmit}>
        <input
          placeholder="Code"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
        />
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          placeholder="Pack constraint"
          value={form.packConstraint}
          onChange={(e) => setForm({ ...form, packConstraint: e.target.value })}
        />
        <input
          type="number"
          placeholder="Order"
          value={form.sortOrder}
          onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
        />
        <button type="submit">{editingId ? 'Save' : 'Add'}</button>
        {editingId && (
          <button type="button" className="ghost" onClick={reset}>
            Cancel
          </button>
        )}
      </form>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : categories.length === 0 ? (
        <p className="muted">No categories yet.</p>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Pack constraint</th>
              <th className="num">Order</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td><code>{cat.code}</code></td>
                <td>{cat.name}</td>
                <td className="muted">{cat.packConstraint}</td>
                <td className="num">{cat.sortOrder}</td>
                <td className="actions">
                  <button onClick={() => startEdit(cat)}>Edit</button>
                  <button className="del" onClick={() => onDelete(cat.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
