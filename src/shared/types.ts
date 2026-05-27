// Shared data contracts between the React client and the Apps Script server.
// Imported by the client for type-safe RPC, and mirrored by the server logic.

// ─── Item (legacy demo entity, kept for backward compatibility) ────────────────

export interface Item {
  /** Stable row id (uuid). */
  id: string;
  name: string;
  quantity: number;
  /** ISO timestamp of last update. */
  updatedAt: string;
}

/** Payload to create a new item (id + updatedAt are assigned server-side). */
export type NewItem = Pick<Item, 'name' | 'quantity'>;

// ─── SkuCategory ───────────────────────────────────────────────────────────────

export interface SkuCategory {
  /** Stable row id (uuid). */
  id: string;
  /** Short code, e.g. "r1f", "hgcm". Unique. */
  code: string;
  /** Display name, e.g. "Syrups". */
  name: string;
  /** Optional pack rule, e.g. "Syrup 2.5kg - 6pc max". */
  packConstraint: string;
  /** Display order in lists. */
  sortOrder: number;
  /** ISO timestamp of last update. */
  updatedAt: string;
}

/** Payload to create a category (id + updatedAt assigned server-side). */
export type NewSkuCategory = Omit<SkuCategory, 'id' | 'updatedAt'>;

// ─── InventoryItem (SKU) ─────────────────────────────────────────────────────────

export interface InventoryItem {
  /** Stable row id (uuid). */
  id: string;
  /** FK → SkuCategory.id. */
  categoryId: string;
  /** Full display name, e.g. "🫐 Blueberry". */
  sku: string;
  /** Optional emoji prefix extracted from the name. */
  emoji: string;
  /** Units per box (pack size). */
  uom: number;

  // Costs — read-only reference data. Set by migration/sheet only; the
  // add/update services preserve existing values and ignore client changes.
  costPerBoxNew: number;
  costPerPieceNew: number;
  costPerPieceOld: number;

  // Selling prices — read-only reference data (see costs above).
  sellingPriceWholesale: number;
  sellingPriceDealer: number;
  sellingPricePiece: number;
  srp: number;

  // Stock by location (pieces, except qtyBox which is full boxes)
  qtyGround: number;
  /** ISO date (YYYY-MM-DD) or '' if none. */
  expiryGround: string;
  qtyUpstair: number;
  /** ISO date (YYYY-MM-DD) or '' if none. */
  expiryUpstair: string;
  qtyBox: number;
  /** ISO date (YYYY-MM-DD) or '' if none. */
  expiryBox: string;

  // Computed / synced (assigned server-side)
  /** ground + upstair + (box × uom). */
  qtyTotal: number;
  /** Quantity from Kyte POS. */
  qtyKyte: number;
  /** true when qtyTotal === qtyKyte (or no Kyte data). */
  kyteMatch: boolean;
  /** costPerPieceNew (or old) × qtyTotal. */
  costTotal: number;

  /** ISO timestamp of last update. */
  updatedAt: string;
}

/** Payload to create a SKU. Computed fields + id + updatedAt are server-assigned. */
export type NewInventoryItem = Omit<
  InventoryItem,
  'id' | 'updatedAt' | 'qtyTotal' | 'kyteMatch' | 'costTotal'
>;

/** A single stock-level change applied in bulk. */
export interface StockUpdate {
  id: string;
  qtyGround: number;
  qtyUpstair: number;
  qtyBox: number;
}

// ─── Summary / Reporting (computed views) ──────────────────────────────────────

export interface InventorySummary {
  totalCost: number;
  totalQty: number;
  categoryCount: number;
  skuCount: number;
  mismatchCount: number;
  zeroStockCount: number;
}

export interface CategoryTotal {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  totalCost: number;
  totalQty: number;
  skuCount: number;
}

// ─── Server contract ───────────────────────────────────────────────────────────

/** Shape of the server functions callable from the client via gas-client. */
export interface ServerFunctions {
  // Legacy demo entity
  getItems(): Item[];
  addItem(item: NewItem): Item;
  updateItem(item: Item): Item;
  deleteItem(id: string): { id: string };

  // Categories
  getCategories(): SkuCategory[];
  addCategory(cat: NewSkuCategory): SkuCategory;
  updateCategory(cat: SkuCategory): SkuCategory;
  deleteCategory(id: string): { id: string };

  // Inventory items
  getInventoryItems(categoryId?: string): InventoryItem[];
  addInventoryItem(item: NewInventoryItem): InventoryItem;
  updateInventoryItem(item: InventoryItem): InventoryItem;
  deleteInventoryItem(id: string): { id: string };
  bulkUpdateStock(updates: StockUpdate[]): InventoryItem[];

  // Summary / reporting
  getInventorySummary(): InventorySummary;
  getCategoryTotals(): CategoryTotal[];
}
