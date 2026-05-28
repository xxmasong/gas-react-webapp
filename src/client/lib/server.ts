// Typed RPC bridge to the Apps Script backend.
//
// gas-client wraps google.script.run and returns promises. In production
// (running inside the GAS iframe) it calls the real server functions. During
// local `vite` dev there is no GAS host, so we fall back to an in-memory mock
// that mirrors the server behaviour — letting you build UI without deploying.

import { GASClient } from 'gas-client';
import type {
  Item,
  NewItem,
  SkuCategory,
  NewSkuCategory,
  InventoryItem,
  NewInventoryItem,
  StockUpdate,
  InventorySummary,
  CategoryTotal,
  ServerFunctions,
} from '@shared/types';

// True only when running inside the deployed GAS iframe.
const isGasHost = typeof google !== 'undefined' && typeof google?.script !== 'undefined';

function createMock(): ServerFunctions {
  const uuid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();

  // ─── Legacy demo entity ──────────────────────────────────────────────────────
  let items: Item[] = [
    { id: 'demo-1', name: 'Sample widget', quantity: 3, updatedAt: now() },
  ];

  // ─── Categories ──────────────────────────────────────────────────────────────
  let categories: SkuCategory[] = [
    { id: 'cat-syrups', code: 'r1f', name: 'Syrups', packConstraint: 'Syrup 2.5kg - 6pc max', sortOrder: 1, updatedAt: now() },
    { id: 'cat-powder', code: 'r2pb', name: 'Powder Base', packConstraint: 'Powder 1kg - 4pc max', sortOrder: 3, updatedAt: now() },
    { id: 'cat-milk', code: 'hgcm', name: 'Milk', packConstraint: '', sortOrder: 21, updatedAt: now() },
  ];

  // ─── Computed-field helpers (mirror inventoryItemService.js) ───────────────────
  const qtyTotalOf = (i: { qtyGround: number; qtyUpstair: number; qtyBox: number; uom: number }) =>
    i.qtyGround + i.qtyUpstair + i.qtyBox * i.uom;
  const unitCostOf = (i: { costPerPieceNew: number; costPerPieceOld: number }) =>
    i.costPerPieceNew > 0 ? i.costPerPieceNew : i.costPerPieceOld;
  function withComputed<T extends Omit<InventoryItem, 'qtyTotal' | 'kyteMatch' | 'costTotal'>>(
    i: T,
  ): InventoryItem {
    const qtyTotal = qtyTotalOf(i);
    const kyteMatch = i.qtyKyte === 0 ? true : qtyTotal === i.qtyKyte;
    return { ...i, qtyTotal, kyteMatch, costTotal: unitCostOf(i) * qtyTotal };
  }

  // ─── Inventory items ───────────────────────────────────────────────────────────
  let inventory: InventoryItem[] = [
    withComputed({
      id: 'inv-blueberry', categoryId: 'cat-syrups', store: 'EASY', sku: '🫐 Blueberry', emoji: '🫐', uom: 6,
      costPerBoxNew: 1752, costPerPieceNew: 292, costPerPieceOld: 278.49,
      sellingPriceWholesale: 288.49, sellingPriceDealer: 288.49, sellingPricePiece: 352, srp: 352,
      qtyGround: 6, expiryGround: '', qtyUpstair: 4, expiryUpstair: '', qtyBox: 7, expiryBox: '',
      qtyKyte: 52, updatedAt: now(),
    }),
    withComputed({
      id: 'inv-caramel', categoryId: 'cat-syrups', store: 'EASY', sku: '🍬 Caramel', emoji: '🍬', uom: 6,
      costPerBoxNew: 1752, costPerPieceNew: 292, costPerPieceOld: 278.49,
      sellingPriceWholesale: 288.49, sellingPriceDealer: 288.49, sellingPricePiece: 352, srp: 352,
      qtyGround: 6, expiryGround: '', qtyUpstair: 5, expiryUpstair: '', qtyBox: 3, expiryBox: '',
      qtyKyte: 47, updatedAt: now(),
    }),
    withComputed({
      id: 'inv-cheesecake', categoryId: 'cat-powder', store: 'EASY', sku: '🍰 Cheesecake', emoji: '🍰', uom: 10,
      costPerBoxNew: 2320, costPerPieceNew: 232, costPerPieceOld: 218.8,
      sellingPriceWholesale: 256, sellingPriceDealer: 226.3, sellingPricePiece: 275, srp: 275,
      qtyGround: 4, expiryGround: '', qtyUpstair: 3, expiryUpstair: '', qtyBox: 3, expiryBox: '',
      qtyKyte: 37, updatedAt: now(),
    }),
  ];

  return {
    // Legacy
    getItems: () => items,
    addItem: (item: NewItem) => {
      const created: Item = { id: uuid(), ...item, updatedAt: now() };
      items = [...items, created];
      return created;
    },
    updateItem: (item: Item) => {
      const updated = { ...item, updatedAt: now() };
      items = items.map((i) => (i.id === item.id ? updated : i));
      return updated;
    },
    deleteItem: (id: string) => {
      items = items.filter((i) => i.id !== id);
      return { id };
    },

    // Categories
    getCategories: () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    addCategory: (cat: NewSkuCategory) => {
      if (categories.some((c) => c.code === cat.code)) {
        throw new Error('Category code already exists: ' + cat.code);
      }
      const created: SkuCategory = { id: uuid(), ...cat, updatedAt: now() };
      categories = [...categories, created];
      return created;
    },
    updateCategory: (cat: SkuCategory) => {
      const updated = { ...cat, updatedAt: now() };
      categories = categories.map((c) => (c.id === cat.id ? updated : c));
      return updated;
    },
    deleteCategory: (id: string) => {
      if (inventory.some((i) => i.categoryId === id)) {
        throw new Error('Category has items; delete items first');
      }
      categories = categories.filter((c) => c.id !== id);
      return { id };
    },

    // Inventory items
    getInventoryItems: (categoryId?: string) =>
      categoryId ? inventory.filter((i) => i.categoryId === categoryId) : inventory,
    addInventoryItem: (item: NewInventoryItem) => {
      const created = withComputed({ ...item, id: uuid(), updatedAt: now() });
      inventory = [...inventory, created];
      return created;
    },
    updateInventoryItem: (item: InventoryItem) => {
      const updated = withComputed({ ...item, updatedAt: now() });
      inventory = inventory.map((i) => (i.id === item.id ? updated : i));
      return updated;
    },
    deleteInventoryItem: (id: string) => {
      inventory = inventory.filter((i) => i.id !== id);
      return { id };
    },
    bulkUpdateStock: (updates: StockUpdate[]) => {
      const changed: InventoryItem[] = [];
      inventory = inventory.map((i) => {
        const u = updates.find((x) => x.id === i.id);
        if (!u) return i;
        const next = withComputed({
          ...i,
          qtyGround: u.qtyGround,
          qtyUpstair: u.qtyUpstair,
          qtyBox: u.qtyBox,
          updatedAt: now(),
        });
        changed.push(next);
        return next;
      });
      return changed;
    },

    // Data management
    reseedInventory: () => {
      inventory = [];
      categories = [];
      return { categories: 0, items: 0 };
    },

    // Summary / reporting
    getInventorySummary: (): InventorySummary => ({
      totalCost: inventory.reduce((s, i) => s + i.costTotal, 0),
      totalQty: inventory.reduce((s, i) => s + i.qtyTotal, 0),
      categoryCount: categories.length,
      skuCount: inventory.length,
      mismatchCount: inventory.filter((i) => !i.kyteMatch).length,
      zeroStockCount: inventory.filter((i) => i.qtyTotal === 0).length,
    }),
    getCategoryTotals: (): CategoryTotal[] =>
      categories.map((cat) => {
        const its = inventory.filter((i) => i.categoryId === cat.id);
        return {
          categoryId: cat.id,
          categoryCode: cat.code,
          categoryName: cat.name,
          totalCost: its.reduce((s, i) => s + i.costTotal, 0),
          totalQty: its.reduce((s, i) => s + i.qtyTotal, 0),
          skuCount: its.length,
        };
      }),
  };
}

let real: ServerFunctions | null = null;
if (isGasHost) {
  real = new GASClient().serverFunctions as unknown as ServerFunctions;
}

const mock = isGasHost ? null : createMock();

// Every call is normalised to a Promise so the UI code is identical in both
// environments (the real gas-client functions already return promises).
function call<K extends keyof ServerFunctions>(
  name: K,
  ...args: Parameters<ServerFunctions[K]>
): Promise<ReturnType<ServerFunctions[K]>> {
  type Ret = Promise<ReturnType<ServerFunctions[K]>>;
  if (real) {
    const fn = real[name] as unknown as (...a: unknown[]) => Ret;
    return fn(...args);
  }
  const fn = mock![name] as unknown as (...a: unknown[]) => ReturnType<ServerFunctions[K]>;
  return Promise.resolve(fn(...args));
}

export const server = {
  // Legacy
  getItems: () => call('getItems'),
  addItem: (item: NewItem) => call('addItem', item),
  updateItem: (item: Item) => call('updateItem', item),
  deleteItem: (id: string) => call('deleteItem', id),

  // Categories
  getCategories: () => call('getCategories'),
  addCategory: (cat: NewSkuCategory) => call('addCategory', cat),
  updateCategory: (cat: SkuCategory) => call('updateCategory', cat),
  deleteCategory: (id: string) => call('deleteCategory', id),

  // Inventory items
  getInventoryItems: (categoryId?: string) => call('getInventoryItems', categoryId),
  addInventoryItem: (item: NewInventoryItem) => call('addInventoryItem', item),
  updateInventoryItem: (item: InventoryItem) => call('updateInventoryItem', item),
  deleteInventoryItem: (id: string) => call('deleteInventoryItem', id),
  bulkUpdateStock: (updates: StockUpdate[]) => call('bulkUpdateStock', updates),

  // Summary / reporting
  getInventorySummary: () => call('getInventorySummary'),
  getCategoryTotals: () => call('getCategoryTotals'),

  // Data management
  reseedInventory: () => call('reseedInventory'),
};

export const runningInGas = isGasHost;
