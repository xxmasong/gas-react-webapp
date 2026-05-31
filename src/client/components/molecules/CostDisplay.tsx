import React from 'react';
import { formatCurrency } from '../../lib/format';

type Props = {
  oldCost: number;
  newCost: number;
};

export const CostDisplay: React.FC<Props> = ({ oldCost, newCost }) => {
  if (!newCost && !oldCost) return <span className="muted">—</span>;
  const effective = newCost > 0 ? newCost : oldCost;
  const changed   = newCost > 0 && oldCost > 0 && oldCost !== newCost;
  const delta     = changed ? newCost - oldCost : 0;
  return (
    <span className="cost">
      <span className="cost-new">{formatCurrency(effective)}</span>
      {changed && (
        <span className="cost-meta">
          <span className="cost-old">{formatCurrency(oldCost)}</span>
          <span className={`cost-delta ${delta > 0 ? 'up' : 'down'}`}>
            {delta > 0 ? '▲' : '▼'} {formatCurrency(Math.abs(delta))}
          </span>
        </span>
      )}
    </span>
  );
};
