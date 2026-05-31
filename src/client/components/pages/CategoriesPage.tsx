import React, { useState } from 'react';
import type { SkuCategory } from '@shared/types';
import { useToast } from '../../providers';
import { cleanError } from '../../lib/errors';
import { useCategories } from '../../features/categories/hooks/useCategories';
import { CategoryForm, CategoryTable } from '../organisms';
import { AppShell } from '../templates';

export const CategoriesPage: React.FC = () => {
  const { categories, loading, error, add, update, remove } = useCategories();
  const toast = useToast();
  const [editing, setEditing] = useState<SkuCategory | null>(null);

  if (error) toast.error(cleanError(error));

  const reset = () => setEditing(null);

  const onSubmit = async (form: { code: string; name: string; packConstraint: string; sortOrder: number }) => {
    try {
      if (editing) {
        await update({ id: editing.id, updatedAt: '', ...form });
        toast.success(`Category "${form.name}" updated.`);
      } else {
        await add(form);
        toast.success(`Category "${form.name}" added.`);
      }
      reset();
    } catch (e) {
      toast.error(`Failed to ${editing ? 'update' : 'add'} category: ${cleanError(e)}`);
    }
  };

  const onDelete = async (id: string) => {
    const cat = categories.find((c) => c.id === id);
    try {
      await remove(id);
      toast.success(`Category "${cat?.name ?? id}" deleted.`);
    } catch (e) {
      toast.error(`Failed to delete category: ${cleanError(e)}`);
    }
  };

  return (
    <AppShell>
      <CategoryForm editing={editing} onSubmit={onSubmit} onCancel={reset} />

      {loading ? (
        <div className="skeleton-table">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton-row" />)}
        </div>
      ) : categories.length === 0 ? (
        <p className="muted">No categories yet.</p>
      ) : (
        <CategoryTable categories={categories} onEdit={setEditing} onDelete={onDelete} />
      )}
    </AppShell>
  );
};
