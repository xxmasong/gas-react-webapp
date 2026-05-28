import { useMutation, useQueryClient } from '@tanstack/react-query';
import { server } from '../lib/server';
import { queryKeys } from '../lib/queryKeys';

export function useReseed() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => server.reseedInventory(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categories });
      qc.invalidateQueries({ queryKey: queryKeys.inventoryItems() });
      qc.invalidateQueries({ queryKey: queryKeys.inventorySummary });
      qc.invalidateQueries({ queryKey: queryKeys.categoryTotals });
    },
  });
}
