import { useQuery } from '@tanstack/react-query';
import { server } from '../../../lib/server';
import { queryKeys } from '../../../lib/queryKeys';

export function useDashboard() {
  const { data: summary = null, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: queryKeys.inventorySummary,
    queryFn: () => server.getInventorySummary(),
  });

  const { data: totals = [], isLoading: totalsLoading, error: totalsError } = useQuery({
    queryKey: queryKeys.categoryTotals,
    queryFn: () => server.getCategoryTotals(),
  });

  return {
    summary,
    totals,
    loading: summaryLoading || totalsLoading,
    error: summaryError || totalsError ? String(summaryError ?? totalsError) : null,
  };
}
