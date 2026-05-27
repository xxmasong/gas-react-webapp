import { useCallback, useEffect, useState } from 'react';
import type { InventoryItem, NewInventoryItem, SkuCategory, StockUpdate } from '@shared/types';
import { server } from '../../../lib/server';

export function useInventoryItems() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<SkuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [its, cats] = await Promise.all([
        server.getInventoryItems(),
        server.getCategories(),
      ]);
      setItems(its);
      setCategories(cats);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (item: NewInventoryItem) => {
    const created = await server.addInventoryItem(item);
    setItems((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (item: InventoryItem) => {
    const updated = await server.updateInventoryItem(item);
    setItems((cur) => cur.map((i) => (i.id === updated.id ? updated : i)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await server.deleteInventoryItem(id);
    setItems((cur) => cur.filter((i) => i.id !== id));
  }, []);

  const bulkUpdateStock = useCallback(async (updates: StockUpdate[]) => {
    const changed = await server.bulkUpdateStock(updates);
    setItems((cur) => {
      const byId = new Map(changed.map((c) => [c.id, c]));
      return cur.map((i) => byId.get(i.id) ?? i);
    });
    return changed;
  }, []);

  return { items, categories, loading, error, setError, add, update, remove, bulkUpdateStock, reload: load };
}
