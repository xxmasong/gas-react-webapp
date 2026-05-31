// Display formatters shared across features.

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const qty = new Intl.NumberFormat('en-PH');

export const formatCurrency = (value: number): string =>
  peso.format(Number.isFinite(value) ? value : 0);

export const formatQty = (value: number): string =>
  qty.format(Number.isFinite(value) ? value : 0);
