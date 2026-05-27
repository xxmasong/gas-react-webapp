import { formatCurrency } from '../../../lib/format';

export function CostDisplay({ oldCost, newCost }: { oldCost: number; newCost: number }) {
  if (!newCost && !oldCost) return <span className="muted">—</span>;
  const effective = newCost > 0 ? newCost : oldCost;
  const delta = newCost > 0 && oldCost > 0 ? newCost - oldCost : 0;
  const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return (
    <span className="cost">
      {oldCost > 0 && newCost > 0 && oldCost !== newCost && (
        <span className="cost-old">{formatCurrency(oldCost)}</span>
      )}
      <span className="cost-new">{formatCurrency(effective)}</span>
      {delta !== 0 && (
        <span className={`cost-delta ${dir}`}>
          {dir === 'up' ? '▲' : '▼'} {formatCurrency(Math.abs(delta))}
        </span>
      )}
    </span>
  );
}
