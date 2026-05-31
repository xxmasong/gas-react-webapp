import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Table } from '@tanstack/react-table';
import type { InventoryItem } from '@shared/types';

type Props = {
  table: Table<InventoryItem>;
};

export const ColumnVisibilityMenu: React.FC<Props> = ({ table }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const toggleable = useMemo(
    () => table.getAllLeafColumns().filter((c) => c.getCanHide() && !c.columnDef.meta?.hidden),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table.getState().columnVisibility],
  );

  const toggle = useCallback(() => setOpen((o) => !o), []);

  return (
    <div className="colvis" ref={ref}>
      <button className="ghost" onClick={toggle}>
        Columns ▾
      </button>
      {open && (
        <div className="colvis-menu">
          {toggleable.map((column) => (
            <label key={column.id} className="colvis-item">
              <input
                type="checkbox"
                checked={column.getIsVisible()}
                onChange={column.getToggleVisibilityHandler()}
              />
              {column.columnDef.meta?.label ?? column.id}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
