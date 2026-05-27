export function MismatchBadge({ qtyTotal, qtyKyte, match }: { qtyTotal: number; qtyKyte: number; match: boolean }) {
  if (qtyKyte === 0) return <span className="muted">—</span>;
  return (
    <span className={`kyte-badge ${match ? 'ok' : 'bad'}`} title={`On hand ${qtyTotal} · Kyte ${qtyKyte}`}>
      {match ? '✓' : `Δ ${qtyTotal - qtyKyte}`}
    </span>
  );
}
