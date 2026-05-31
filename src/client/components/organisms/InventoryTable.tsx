import React, { useMemo } from 'react';
import { flexRender, type Table } from '@tanstack/react-table';
import type { InventoryItem } from '@shared/types';
import { formatCurrency, formatQty } from '../../lib/format';
import { InventoryRow } from './InventoryRow';

type Props = {
  table: Table<InventoryItem>;
  catName: (id: string) => string;
  canEditSku: boolean;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
};

export const InventoryTable: React.FC<Props> = ({ table, catName, canEditSku, onEdit, onDelete }) => {
  const visibleLeafCount = useMemo(
    () => table.getVisibleLeafColumns().filter((c) => !c.columnDef.meta?.hidden).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table.getState().columnVisibility],
  );

  return (
    <table className="grid inventory">
      <colgroup>
        {table.getVisibleLeafColumns().map((col) => {
          if (col.columnDef.meta?.hidden) return null;
          const size = col.columnDef.size;
          return <col key={col.id} style={{ width: size === 999 ? undefined : size }} />;
        })}
      </colgroup>

      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((header) => {
              if (header.column.columnDef.meta?.hidden) return null;
              const align   = header.column.columnDef.meta?.align;
              const canSort = header.column.getCanSort();
              const sortDir = header.column.getIsSorted();
              return (
                <th
                  key={header.id}
                  className={`${align === 'right' ? 'num' : ''} ${canSort ? 'sortable' : ''}`.trim() || undefined}
                  onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {canSort && (
                    <span className="sort-ind">
                      {sortDir === 'asc' ? ' ▲' : sortDir === 'desc' ? ' ▼' : ''}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>

      <tbody>
        {table.getRowModel().rows.map((row) => {
          if (row.getIsGrouped()) {
            const catId    = row.getValue<string>('categoryId');
            const leafRows = row.getLeafRows();
            const cost     = leafRows.reduce((s, r) => s + r.original.costTotal, 0);
            const qty      = leafRows.reduce((s, r) => s + r.original.qtyTotal,  0);
            const nameCols = Math.ceil(visibleLeafCount / 2);
            return (
              <tr key={row.id} className="cat-group-row">
                <td colSpan={nameCols} className="cat-group-name">{catName(catId)}</td>
                <td colSpan={visibleLeafCount - nameCols} className="cat-group-totals">
                  {formatCurrency(cost)} · {formatQty(qty)} pcs
                </td>
              </tr>
            );
          }
          return (
            <InventoryRow
              key={row.id}
              row={row}
              canEdit={canEditSku}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          );
        })}
      </tbody>
    </table>
  );
};
