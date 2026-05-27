// Display formatters shared across features.

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number): string {
  return peso.format(Number.isFinite(value) ? value : 0);
}

export function formatQty(value: number): string {
  return new Intl.NumberFormat('en-PH').format(Number.isFinite(value) ? value : 0);
}
