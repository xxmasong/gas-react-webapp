import { useEffect, useRef, useState } from 'react';
import type { Table } from '@tanstack/react-table';
import type { InventoryItem } from '@shared/types';

export function ColumnVisibilityMenu({ table }: { table: Table<InventoryItem> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
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
}
