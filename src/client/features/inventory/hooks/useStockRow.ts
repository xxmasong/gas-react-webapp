import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InventoryItem } from '@shared/types';
import { server } from '../../../lib/server';
import { queryKeys } from '../../../lib/queryKeys';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'mismatch';

// Manages one inventory row's editable stock quantities, an explicit save
// (save + read-back verify against the sheet), and a visible status.
export function useStockRow(item: InventoryItem) {
  const qc = useQueryClient();
  const [ground, setGround] = useState(item.qtyGround);
  const [upstair, setUpstair] = useState(item.qtyUpstair);
  const [box, setBox] = useState(item.qtyBox);
  const [status, setStatus] = useState<SaveStatus>('idle');

  // If the underlying item changes from elsewhere (e.g. a background refetch
  // or reseed) and we have no unsaved edits, sync the inputs to it.
  useEffect(() => {
    if (status === 'idle') {
      setGround(item.qtyGround);
      setUpstair(item.qtyUpstair);
      setBox(item.qtyBox);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.qtyGround, item.qtyUpstair, item.qtyBox]);

  const dirty = ground !== item.qtyGround || upstair !== item.qtyUpstair || box !== item.qtyBox;
  const liveTotal = ground + upstair + box * item.uom;

  const mutation = useMutation({
    mutationFn: () =>
      server.saveAndVerifyStock({ id: item.id, qtyGround: ground, qtyUpstair: upstair, qtyBox: box }),
    onMutate: () => setStatus('saving'),
    onSuccess: (fresh) => {
      // Verify the sheet now holds exactly what we sent.
      const ok =
        fresh.qtyGround === ground && fresh.qtyUpstair === upstair && fresh.qtyBox === box;
      // Write the verified row into the cache so the whole UI reflects the sheet.
      qc.setQueryData<InventoryItem[]>(queryKeys.inventoryItems(), (prev = []) =>
        prev.map((i) => (i.id === fresh.id ? fresh : i)),
      );
      qc.invalidateQueries({ queryKey: queryKeys.inventorySummary });
      qc.invalidateQueries({ queryKey: queryKeys.categoryTotals });
      setStatus(ok ? 'saved' : 'mismatch');
      if (ok) window.setTimeout(() => setStatus('idle'), 2000);
    },
    onError: () => setStatus('error'),
  });

  function save() {
    if (dirty && status !== 'saving') mutation.mutate();
  }

  function reset() {
    setGround(item.qtyGround);
    setUpstair(item.qtyUpstair);
    setBox(item.qtyBox);
    setStatus('idle');
  }

  return {
    ground, upstair, box,
    setGround, setUpstair, setBox,
    dirty, liveTotal, status, save, reset,
  };
}
