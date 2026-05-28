import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { server } from '../../../lib/server';
import { queryKeys } from '../../../lib/queryKeys';
import {
  computeKpis, valueByCategory, valueByStore, topSkusByValue, abcAnalysis,
  stockHealth, attentionList,
} from '../lib/analytics';

export function useAnalytics() {
  const itemsQ = useQuery({
    queryKey: queryKeys.inventoryItems(),
    queryFn: () => server.getInventoryItems(),
  });
  const catsQ = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => server.getCategories(),
  });

  const items = itemsQ.data ?? [];
  const categories = catsQ.data ?? [];

  const analytics = useMemo(() => {
    const kpis = computeKpis(items, categories.length);
    return {
      kpis,
      byCategory: valueByCategory(items, categories),
      byStore: valueByStore(items),
      topSkus: topSkusByValue(items, 10),
      abc: abcAnalysis(items),
      health: stockHealth(kpis),
      attention: attentionList(items),
    };
  }, [items, categories]);

  return {
    ...analytics,
    loading: itemsQ.isLoading || catsQ.isLoading,
    error: itemsQ.error || catsQ.error ? String(itemsQ.error ?? catsQ.error) : null,
    isEmpty: !itemsQ.isLoading && items.length === 0,
  };
}
