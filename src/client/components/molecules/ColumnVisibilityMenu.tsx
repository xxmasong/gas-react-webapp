import React, { useEffect, useRef, useState } from 'react';
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

  const toggleable = table
    .getAllLeafColumns()
    .filter((c) => c.getCanHide() && !c.columnDef.meta?.hidden);

  return (
    <div className="colvis" ref={ref}>
      <button className="ghost" onClick={() => setOpen((o) => !o)}>
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
