import React, { useState } from 'react';
import type { SkuCategory } from '@shared/types';

const EMPTY = { code: '', name: '', packConstraint: '', sortOrder: 0 };

type Props = {
  editing: SkuCategory | null;
  onSubmit: (form: typeof EMPTY) => Promise<void>;
  onCancel: () => void;
};

export const CategoryForm: React.FC<Props> = ({ editing, onSubmit, onCancel }) => {
  const [form, setForm] = useState(
    editing
      ? { code: editing.code, name: editing.name, packConstraint: editing.packConstraint, sortOrder: editing.sortOrder }
      : EMPTY,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) return;
    await onSubmit(form);
  };

  return (
    <form className="cat-form" onSubmit={handleSubmit}>
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
      <button type="submit">{editing ? 'Save' : 'Add'}</button>
      {editing && (
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
};
