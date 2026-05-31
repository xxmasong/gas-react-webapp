import React from 'react';

type Props = {
  qtyTotal: number;
  qtyKyte: number;
  match: boolean;
};

export const MismatchBadge: React.FC<Props> = ({ qtyTotal, qtyKyte, match }) => {
  if (qtyKyte === 0) return <span className="muted">—</span>;
  return (
    <span
      className={`kyte-badge ${match ? 'ok' : 'bad'}`}
      title={`On hand ${qtyTotal} · Kyte ${qtyKyte}`}
    >
      {match ? '✓' : `Δ ${qtyTotal - qtyKyte}`}
    </span>
  );
};
