export const queryKeys = {
  categories: ['categories'] as const,
  inventoryItems: (categoryId?: string) =>
    categoryId ? ['inventoryItems', categoryId] : (['inventoryItems'] as const),
  inventorySummary: ['inventorySummary'] as const,
  categoryTotals: ['categoryTotals'] as const,
};
