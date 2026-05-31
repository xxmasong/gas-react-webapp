import React, { useCallback, useState } from 'react';
import type { SkuCategory } from '@shared/types';

const EMPTY = { code: '', name: '', packConstraint: '', sortOrder: 0 };

type Props = {
  editing: SkuCategory | null;
  onSubmit: (form: typeof EMPTY) => Promise<void>;
  onCancel: () => void;
};

export const CategoryForm: React.FC<Props> = ({ editing, onSubmit, onCancel }) => {
  const [form, setForm] = useState(() =>
    editing
      ? { code: editing.code, name: editing.name, packConstraint: editing.packConstraint, sortOrder: editing.sortOrder }
      : EMPTY,
  );

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) return;
    await onSubmit(form);
  }, [form, onSubmit]);

  const onCodeChange    = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, code: e.target.value })), []);
  const onNameChange    = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, name: e.target.value })), []);
  const onConstraintChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, packConstraint: e.target.value })), []);
  const onOrderChange   = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) })), []);

  return (
    <form className="cat-form" onSubmit={handleSubmit}>
      <input placeholder="Code"            value={form.code}            onChange={onCodeChange} />
      <input placeholder="Name"            value={form.name}            onChange={onNameChange} />
      <input placeholder="Pack constraint" value={form.packConstraint}  onChange={onConstraintChange} />
      <input type="number" placeholder="Order" value={form.sortOrder}   onChange={onOrderChange} />
      <button type="submit">{editing ? 'Save' : 'Add'}</button>
      {editing && (
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
};
