import { useEffect, useState } from 'react';
import type { CategoryTotal, InventorySummary } from '@shared/types';
import { server } from '../../../lib/server';

export function useDashboard() {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [totals, setTotals] = useState<CategoryTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const [s, t] = await Promise.all([
          server.getInventorySummary(),
          server.getCategoryTotals(),
        ]);
        setSummary(s);
        setTotals(t);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { summary, totals, loading, error };
}
