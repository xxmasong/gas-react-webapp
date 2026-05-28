import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { InventoryItem, NewInventoryItem, StockUpdate } from '@shared/types';
import { server } from '../../../lib/server';
import { queryKeys } from '../../../lib/queryKeys';

export function useInventoryItems() {
  const qc = useQueryClient();

  const { data: items = [], isLoading: itemsLoading, error: itemsError } = useQuery({
    queryKey: queryKeys.inventoryItems(),
    queryFn: () => server.getInventoryItems(),
  });

  const { data: categories = [], isLoading: catsLoading, error: catsError } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => server.getCategories(),
  });

  const loading = itemsLoading || catsLoading;
  const fetchError = itemsError || catsError;

  const addMutation = useMutation({
    mutationFn: (item: NewInventoryItem) => server.addInventoryItem(item),
    onSuccess: (created) => {
      qc.setQueryData<InventoryItem[]>(queryKeys.inventoryItems(), (prev = []) => [...prev, created]);
      qc.invalidateQueries({ queryKey: queryKeys.inventorySummary });
      qc.invalidateQueries({ queryKey: queryKeys.categoryTotals });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (item: InventoryItem) => server.updateInventoryItem(item),
    onSuccess: (updated) => {
      qc.setQueryData<InventoryItem[]>(queryKeys.inventoryItems(), (prev = []) =>
        prev.map((i) => (i.id === updated.id ? updated : i)),
      );
      qc.invalidateQueries({ queryKey: queryKeys.inventorySummary });
      qc.invalidateQueries({ queryKey: queryKeys.categoryTotals });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => server.deleteInventoryItem(id),
    onSuccess: (_, id) => {
      qc.setQueryData<InventoryItem[]>(queryKeys.inventoryItems(), (prev = []) =>
        prev.filter((i) => i.id !== id),
      );
      qc.invalidateQueries({ queryKey: queryKeys.inventorySummary });
      qc.invalidateQueries({ queryKey: queryKeys.categoryTotals });
    },
  });

  const bulkStockMutation = useMutation({
    mutationFn: (updates: StockUpdate[]) => server.bulkUpdateStock(updates),
    onSuccess: (changed) => {
      const byId = new Map(changed.map((c) => [c.id, c]));
      qc.setQueryData<InventoryItem[]>(queryKeys.inventoryItems(), (prev = []) =>
        prev.map((i) => byId.get(i.id) ?? i),
      );
      qc.invalidateQueries({ queryKey: queryKeys.inventorySummary });
      qc.invalidateQueries({ queryKey: queryKeys.categoryTotals });
    },
  });

  const mutationError =
    addMutation.error || updateMutation.error || removeMutation.error || bulkStockMutation.error;

  return {
    items,
    categories,
    loading,
    error: fetchError ? String(fetchError) : mutationError ? String(mutationError) : null,
    add: addMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    bulkUpdateStock: (updates: StockUpdate[]) => bulkStockMutation.mutateAsync(updates),
  };
}
