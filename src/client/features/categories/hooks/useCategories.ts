import { useCallback, useEffect, useState } from 'react';
import type { SkuCategory, NewSkuCategory } from '@shared/types';
import { server } from '../../../lib/server';

export function useCategories() {
  const [categories, setCategories] = useState<SkuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setCategories(await server.getCategories());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (cat: NewSkuCategory) => {
    const created = await server.addCategory(cat);
    setCategories((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
    return created;
  }, []);

  const update = useCallback(async (cat: SkuCategory) => {
    const updated = await server.updateCategory(cat);
    setCategories((cur) =>
      cur.map((c) => (c.id === updated.id ? updated : c)).sort((a, b) => a.sortOrder - b.sortOrder),
    );
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await server.deleteCategory(id);
    setCategories((cur) => cur.filter((c) => c.id !== id));
  }, []);

  return { categories, loading, error, setError, add, update, remove, reload: load };
}
