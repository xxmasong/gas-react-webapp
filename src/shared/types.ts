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

/** The two physical stores/warehouses tracked in the Product Info sheet. */
export type Store = 'EASY' | 'GRUTON';

export interface InventoryItem {
  /** Stable row id (uuid). */
  id: string;
  /** FK → SkuCategory.id. */
  categoryId: string;
  /** Which store/warehouse this SKU belongs to (EASY or GRUTON). */
  store: Store;
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

// ─── Auth ──────────────────────────────────────────────────────────────────────

/** Roles, least → most privileged. */
export type Role = 'inventory_staff' | 'supervisor' | 'admin';

/** Public user shape (never includes the password hash). */
export interface User {
  id: string;
  username: string;
  role: Role;
  active: boolean;
}

/** Result of a successful login. */
export interface AuthSession {
  token: string;
  user: User;
  /** ISO timestamp when the session expires. */
  expiresAt: string;
}

// ─── Server contract ───────────────────────────────────────────────────────────

/**
 * Shape of the raw server functions callable via gas-client. Every data
 * function takes the session `token` as its first argument; the client `server`
 * bridge injects it automatically so view code doesn't pass it manually.
 */
export interface ServerFunctions {
  // Auth (login takes no token)
  login(username: string, password: string): AuthSession;
  logout(token: string): { ok: true };
  me(token: string): User | null;
  changeOwnPassword(token: string, currentPassword: string, newPassword: string): { ok: true };

  // Admin: user management
  listUsers(token: string): User[];
  registerUser(token: string, username: string, password: string, role: Role): User;
  setUserActive(token: string, userId: string, active: boolean): User;
  setUserRole(token: string, userId: string, role: Role): User;
  deleteUserAccount(token: string, userId: string): { id: string };

  // Legacy demo entity
  getItems(token: string): Item[];
  addItem(token: string, item: NewItem): Item;
  updateItem(token: string, item: Item): Item;
  deleteItem(token: string, id: string): { id: string };

  // Categories
  getCategories(token: string): SkuCategory[];
  addCategory(token: string, cat: NewSkuCategory): SkuCategory;
  updateCategory(token: string, cat: SkuCategory): SkuCategory;
  deleteCategory(token: string, id: string): { id: string };

  // Inventory items
  getInventoryItems(token: string, categoryId?: string): InventoryItem[];
  addInventoryItem(token: string, item: NewInventoryItem): InventoryItem;
  updateInventoryItem(token: string, item: InventoryItem): InventoryItem;
  deleteInventoryItem(token: string, id: string): { id: string };
  bulkUpdateStock(token: string, updates: StockUpdate[]): InventoryItem[];
  saveAndVerifyStock(token: string, update: StockUpdate): InventoryItem;

  // Summary / reporting
  getInventorySummary(token: string): InventorySummary;
  getCategoryTotals(token: string): CategoryTotal[];

  // Data management
  reseedInventory(token: string): { categories: number; items: number };
}
