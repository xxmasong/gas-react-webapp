import React from 'react';
import type { Table } from '@tanstack/react-table';
import type { InventoryItem } from '@shared/types';
import { formatCurrency, formatQty } from '../../lib/format';
import { InventoryCard } from './InventoryCard';

type Props = {
  table: Table<InventoryItem>;
  catName: (id: string) => string;
  canEditSku: boolean;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
};

export const InventoryCardList: React.FC<Props> = ({ table, catName, canEditSku, onEdit, onDelete }) => (
  <div className="inv-cards">
    {table.getRowModel().rows.map((row) => {
      if (row.getIsGrouped()) {
        const catId    = row.getValue<string>('categoryId');
        const leafRows = row.getLeafRows();
        const cost     = leafRows.reduce((s, r) => s + r.original.costTotal, 0);
        const qty      = leafRows.reduce((s, r) => s + r.original.qtyTotal,  0);
        return (
          <div key={row.id} className="inv-cards-group-header">
            <span className="inv-cards-group-name">{catName(catId)}</span>
            <span className="inv-cards-group-totals">
              {formatCurrency(cost)} · {formatQty(qty)} pcs
            </span>
          </div>
        );
      }
      return (
        <InventoryCard
          key={row.id}
          item={row.original}
          canEdit={canEditSku}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );
    })}
  </div>
);
