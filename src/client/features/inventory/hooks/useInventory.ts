import { useCallback, useEffect, useState } from 'react';
import type { Item, NewItem } from '@shared/types';
import { server } from '../../../lib/server';

export function useInventory() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await server.getItems();
      setItems(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (item: NewItem) => {
    const created = await server.addItem(item);
    setItems((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (item: Item) => {
    const updated = await server.updateItem(item);
    setItems((cur) => cur.map((i) => (i.id === updated.id ? updated : i)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await server.deleteItem(id);
    setItems((cur) => cur.filter((i) => i.id !== id));
  }, []);

  return { items, loading, error, setError, add, update, remove, reload: load };
}
