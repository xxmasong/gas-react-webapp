// Typed RPC bridge to the Apps Script backend.
//
// gas-client wraps google.script.run and returns promises. In production
// (running inside the GAS iframe) it calls the real server functions. During
// local `vite` dev there is no GAS host, so we fall back to an in-memory mock
// that mirrors the server behaviour — letting you build UI without deploying.
//
// AUTH: every data function on the server takes the session token as its first
// argument. This bridge holds the current token and injects it automatically,
// so view/hook code calls e.g. server.getCategories() with no token.

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
  AuthSession,
  User,
  Role,
} from '@shared/types';

// True only when running inside the deployed GAS iframe.
const isGasHost = typeof google !== 'undefined' && typeof google?.script !== 'undefined';

// ─── Session token store ───────────────────────────────────────────────────────
const TOKEN_KEY = 'inventory.session';

let currentToken: string | null =
  typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;

export function setToken(token: string | null) {
  currentToken = token;
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return currentToken;
}

function createMock(): ServerFunctions {
  const uuid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();

  // ─── Mock auth state ─────────────────────────────────────────────────────────
  type MockUser = User & { password: string };
  let users: MockUser[] = [
    { id: 'u-admin', username: 'admin', role: 'admin', active: true, password: 'Admin-2026!' },
    { id: 'u-sup', username: 'supervisor', role: 'supervisor', active: true, password: 'Super-2026!' },
    { id: 'u-staff', username: 'staff', role: 'inventory_staff', active: true, password: 'Staff-2026!' },
  ];
  const strongPw = (p: string) => {
    if (p.length < 10) return false;
    let classes = 0;
    if (/[a-z]/.test(p)) classes++;
    if (/[A-Z]/.test(p)) classes++;
    if (/[0-9]/.test(p)) classes++;
    if (/[^A-Za-z0-9]/.test(p)) classes++;
    return classes >= 3;
  };
  const sessions = new Map<string, string>(); // token -> userId
  const RANK: Record<Role, number> = { inventory_staff: 1, supervisor: 2, admin: 3 };
  const pub = (u: MockUser): User => ({ id: u.id, username: u.username, role: u.role, active: u.active });

  function userFor(token: string): MockUser {
    const id = sessions.get(token);
    const u = id ? users.find((x) => x.id === id) : undefined;
    if (!u || !u.active) throw new Error('Not signed in or session expired');
    return u;
  }
  function requireRole(token: string, min: Role): MockUser {
    const u = userFor(token);
    if (RANK[u.role] < RANK[min]) throw new Error('Insufficient permissions for this action');
    return u;
  }

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
    // Auth
    login: (username, password) => {
      const u = users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
      if (!u || u.password !== password) throw new Error('Invalid username or password');
      if (!u.active) throw new Error('Account is deactivated');
      const token = 'mock-' + uuid();
      sessions.set(token, u.id);
      const expiresAt = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
      return { token, user: pub(u), expiresAt } as AuthSession;
    },
    logout: (token) => { sessions.delete(token); return { ok: true } as const; },
    me: (token) => { try { return pub(userFor(token)); } catch { return null; } },
    changeOwnPassword: (token, currentPassword, newPassword) => {
      const u = userFor(token);
      if (u.password !== currentPassword) throw new Error('Current password is incorrect');
      if (!strongPw(newPassword))
        throw new Error('Password must be ≥10 chars and include 3 of: lower, upper, number, symbol');
      u.password = newPassword;
      return { ok: true } as const;
    },

    // Admin: user management
    listUsers: (token) => { requireRole(token, 'admin'); return users.map(pub); },
    registerUser: (token, username, password, role) => {
      requireRole(token, 'admin');
      if (username.trim().length < 3) throw new Error('Username must be at least 3 characters');
      if (!strongPw(password))
        throw new Error('Password must be ≥10 chars and include 3 of: lower, upper, number, symbol');
      if (users.some((x) => x.username.toLowerCase() === username.trim().toLowerCase()))
        throw new Error('Username already taken: ' + username);
      const created: MockUser = { id: uuid(), username: username.trim(), role, active: true, password };
      users = [...users, created];
      return pub(created);
    },
    setUserActive: (token, userId, active) => {
      const actor = requireRole(token, 'admin');
      if (userId === actor.id) throw new Error('You cannot deactivate your own account');
      users = users.map((u) => (u.id === userId ? { ...u, active } : u));
      const u = users.find((x) => x.id === userId);
      if (!u) throw new Error('User not found');
      return pub(u);
    },
    setUserRole: (token, userId, role) => {
      const actor = requireRole(token, 'admin');
      if (userId === actor.id) throw new Error('You cannot change your own role');
      users = users.map((u) => (u.id === userId ? { ...u, role } : u));
      const u = users.find((x) => x.id === userId);
      if (!u) throw new Error('User not found');
      return pub(u);
    },
    deleteUserAccount: (token, userId) => {
      const actor = requireRole(token, 'admin');
      if (userId === actor.id) throw new Error('You cannot delete your own account');
      users = users.filter((u) => u.id !== userId);
      return { id: userId };
    },

    // Legacy
    getItems: (token) => { userFor(token); return items; },
    addItem: (token, item: NewItem) => {
      requireRole(token, 'supervisor');
      const created: Item = { id: uuid(), ...item, updatedAt: now() };
      items = [...items, created];
      return created;
    },
    updateItem: (token, item: Item) => {
      requireRole(token, 'supervisor');
      const updated = { ...item, updatedAt: now() };
      items = items.map((i) => (i.id === item.id ? updated : i));
      return updated;
    },
    deleteItem: (token, id: string) => {
      requireRole(token, 'supervisor');
      items = items.filter((i) => i.id !== id);
      return { id };
    },

    // Categories
    getCategories: (token) => { userFor(token); return [...categories].sort((a, b) => a.sortOrder - b.sortOrder); },
    addCategory: (token, cat: NewSkuCategory) => {
      requireRole(token, 'supervisor');
      if (categories.some((c) => c.code === cat.code)) {
        throw new Error('Category code already exists: ' + cat.code);
      }
      const created: SkuCategory = { id: uuid(), ...cat, updatedAt: now() };
      categories = [...categories, created];
      return created;
    },
    updateCategory: (token, cat: SkuCategory) => {
      requireRole(token, 'supervisor');
      const updated = { ...cat, updatedAt: now() };
      categories = categories.map((c) => (c.id === cat.id ? updated : c));
      return updated;
    },
    deleteCategory: (token, id: string) => {
      requireRole(token, 'supervisor');
      if (inventory.some((i) => i.categoryId === id)) {
        throw new Error('Category has items; delete items first');
      }
      categories = categories.filter((c) => c.id !== id);
      return { id };
    },

    // Inventory items
    getInventoryItems: (token, categoryId?: string) => {
      userFor(token);
      return categoryId ? inventory.filter((i) => i.categoryId === categoryId) : inventory;
    },
    addInventoryItem: (token, item: NewInventoryItem) => {
      requireRole(token, 'supervisor');
      const created = withComputed({ ...item, id: uuid(), updatedAt: now() });
      inventory = [...inventory, created];
      return created;
    },
    updateInventoryItem: (token, item: InventoryItem) => {
      requireRole(token, 'supervisor');
      const updated = withComputed({ ...item, updatedAt: now() });
      inventory = inventory.map((i) => (i.id === item.id ? updated : i));
      return updated;
    },
    deleteInventoryItem: (token, id: string) => {
      requireRole(token, 'supervisor');
      inventory = inventory.filter((i) => i.id !== id);
      return { id };
    },
    bulkUpdateStock: (token, updates: StockUpdate[]) => {
      requireRole(token, 'inventory_staff');
      const changed: InventoryItem[] = [];
      inventory = inventory.map((i) => {
        const u = updates.find((x) => x.id === i.id);
        if (!u) return i;
        const next = withComputed({
          ...i, qtyGround: u.qtyGround, qtyUpstair: u.qtyUpstair, qtyBox: u.qtyBox, updatedAt: now(),
        });
        changed.push(next);
        return next;
      });
      return changed;
    },
    saveAndVerifyStock: (token, update: StockUpdate) => {
      requireRole(token, 'inventory_staff');
      let saved: InventoryItem | undefined;
      inventory = inventory.map((i) => {
        if (i.id !== update.id) return i;
        saved = withComputed({
          ...i, qtyGround: update.qtyGround, qtyUpstair: update.qtyUpstair, qtyBox: update.qtyBox, updatedAt: now(),
        });
        return saved;
      });
      if (!saved) throw new Error('InventoryItem not found: ' + update.id);
      return saved;
    },

    // Data management
    reseedInventory: (token) => {
      requireRole(token, 'supervisor');
      inventory = [];
      categories = [];
      return { categories: 0, items: 0 };
    },

    // Summary / reporting
    getInventorySummary: (token): InventorySummary => {
      userFor(token);
      return {
        totalCost: inventory.reduce((s, i) => s + i.costTotal, 0),
        totalQty: inventory.reduce((s, i) => s + i.qtyTotal, 0),
        categoryCount: categories.length,
        skuCount: inventory.length,
        mismatchCount: inventory.filter((i) => !i.kyteMatch).length,
        zeroStockCount: inventory.filter((i) => i.qtyTotal === 0).length,
      };
    },
    getCategoryTotals: (token): CategoryTotal[] => {
      userFor(token);
      return categories.map((cat) => {
        const its = inventory.filter((i) => i.categoryId === cat.id);
        return {
          categoryId: cat.id,
          categoryCode: cat.code,
          categoryName: cat.name,
          totalCost: its.reduce((s, i) => s + i.costTotal, 0),
          totalQty: its.reduce((s, i) => s + i.qtyTotal, 0),
          skuCount: its.length,
        };
      });
    },
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

// Inject the current session token as the first argument.
function authed<K extends keyof ServerFunctions>(
  name: K,
  ...rest: unknown[]
): Promise<ReturnType<ServerFunctions[K]>> {
  return call(name, ...([currentToken, ...rest] as Parameters<ServerFunctions[K]>));
}

export const server = {
  // Auth — login takes no token; the rest get it injected
  login: (username: string, password: string) => call('login', username, password),
  logout: () => authed('logout'),
  me: () => authed('me'),
  changeOwnPassword: (cur: string, next: string) => authed('changeOwnPassword', cur, next),

  // Admin: user management
  listUsers: () => authed('listUsers'),
  registerUser: (username: string, password: string, role: Role) =>
    authed('registerUser', username, password, role),
  setUserActive: (userId: string, active: boolean) => authed('setUserActive', userId, active),
  setUserRole: (userId: string, role: Role) => authed('setUserRole', userId, role),
  deleteUserAccount: (userId: string) => authed('deleteUserAccount', userId),

  // Legacy
  getItems: () => authed('getItems'),
  addItem: (item: NewItem) => authed('addItem', item),
  updateItem: (item: Item) => authed('updateItem', item),
  deleteItem: (id: string) => authed('deleteItem', id),

  // Categories
  getCategories: () => authed('getCategories'),
  addCategory: (cat: NewSkuCategory) => authed('addCategory', cat),
  updateCategory: (cat: SkuCategory) => authed('updateCategory', cat),
  deleteCategory: (id: string) => authed('deleteCategory', id),

  // Inventory items
  getInventoryItems: (categoryId?: string) => authed('getInventoryItems', categoryId),
  addInventoryItem: (item: NewInventoryItem) => authed('addInventoryItem', item),
  updateInventoryItem: (item: InventoryItem) => authed('updateInventoryItem', item),
  deleteInventoryItem: (id: string) => authed('deleteInventoryItem', id),
  bulkUpdateStock: (updates: StockUpdate[]) => authed('bulkUpdateStock', updates),
  saveAndVerifyStock: (update: StockUpdate) => authed('saveAndVerifyStock', update),

  // Summary / reporting
  getInventorySummary: () => authed('getInventorySummary'),
  getCategoryTotals: () => authed('getCategoryTotals'),

  // Data management
  reseedInventory: () => authed('reseedInventory'),
};

export const runningInGas = isGasHost;
