// In-memory mock of the Apps Script backend — active only during local `vite dev`.
// Mirrors server business rules (auth, role checks, computed fields) so the UI
// can be developed and tested without a live GAS deployment.

import type {
  Item, NewItem,
  SkuCategory, NewSkuCategory,
  InventoryItem, NewInventoryItem, StockUpdate,
  InventorySummary, CategoryTotal,
  ServerFunctions, AuthSession, User, Role,
} from '@shared/types';
import { ROLE_RANK } from '@shared/types';
import seedData from '../../mock/seed.json';

// ─── Internal helpers ────────────────────────────────────────────────────────

type MockUser = User & { password: string };

const uuid = () => crypto.randomUUID();
const now  = () => new Date().toISOString();

const strongPw = (p: string): boolean => {
  if (p.length < 10) return false;
  let classes = 0;
  if (/[a-z]/.test(p)) classes++;
  if (/[A-Z]/.test(p)) classes++;
  if (/[0-9]/.test(p)) classes++;
  if (/[^A-Za-z0-9]/.test(p)) classes++;
  return classes >= 3;
};

// Computed-field helpers (mirror inventoryItemService.js).
const withComputed = (
  i: Omit<InventoryItem, 'qtyTotal' | 'kyteMatch' | 'costTotal'>,
): InventoryItem => {
  const qtyTotal  = i.qtyGround + i.qtyUpstair + i.qtyBox * i.uom;
  const kyteMatch = i.qtyKyte === 0 ? true : qtyTotal === i.qtyKyte;
  const unitCost  = i.costPerPieceNew > 0 ? i.costPerPieceNew : i.costPerPieceOld;
  return { ...i, qtyTotal, kyteMatch, costTotal: unitCost * qtyTotal };
};

// ─── Seed data (loaded from mock/seed.json) ──────────────────────────────────

let users: MockUser[] = seedData.users.map((u) => ({ ...u, role: u.role as Role }));

const sessions = new Map<string, string>(); // token → userId

let categories: SkuCategory[] = seedData.categories.map((c) => ({ ...c, updatedAt: now() }));

let items: Item[] = seedData.items.map((i) => ({ ...i, updatedAt: now() }));

type SeedInventoryItem = Omit<InventoryItem, 'qtyTotal' | 'kyteMatch' | 'costTotal' | 'updatedAt'>;

let inventory: InventoryItem[] = seedData.inventory.map((i) =>
  withComputed({ ...(i as SeedInventoryItem), store: i.store as InventoryItem['store'], updatedAt: now() }),
);

// ─── Auth guards ─────────────────────────────────────────────────────────────

const pub = (u: MockUser): User => ({ id: u.id, username: u.username, role: u.role, active: u.active });

const userFor = (token: string): MockUser => {
  const id = sessions.get(token);
  const u  = id ? users.find((x) => x.id === id) : undefined;
  if (!u || !u.active) throw new Error('Not signed in or session expired');
  return u;
};

const requireRole = (token: string, min: Role): MockUser => {
  const u = userFor(token);
  if (ROLE_RANK[u.role] < ROLE_RANK[min]) throw new Error('Insufficient permissions for this action');
  return u;
};

// ─── Mock implementation ─────────────────────────────────────────────────────

export const createMock = (): ServerFunctions => {
  return {
    // ── Auth ──────────────────────────────────────────────────────────────────
    login: (username, password) => {
      const u = users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
      if (!u || u.password !== password) throw new Error('Invalid username or password');
      if (!u.active) throw new Error('Account is deactivated');
      const token     = 'mock-' + uuid();
      const expiresAt = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
      sessions.set(token, u.id);
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

    // ── User management (admin) ───────────────────────────────────────────────
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

    // ── Legacy items ──────────────────────────────────────────────────────────
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

    // ── Categories ────────────────────────────────────────────────────────────
    getCategories: (token) => { userFor(token); return [...categories].sort((a, b) => a.sortOrder - b.sortOrder); },
    addCategory: (token, cat: NewSkuCategory) => {
      requireRole(token, 'supervisor');
      if (categories.some((c) => c.code === cat.code))
        throw new Error('Category code already exists: ' + cat.code);
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
      if (inventory.some((i) => i.categoryId === id))
        throw new Error('Category has items; delete items first');
      categories = categories.filter((c) => c.id !== id);
      return { id };
    },

    // ── Inventory items ───────────────────────────────────────────────────────
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
        const next = withComputed({ ...i, qtyGround: u.qtyGround, qtyUpstair: u.qtyUpstair, qtyBox: u.qtyBox, updatedAt: now() });
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
        saved = withComputed({ ...i, qtyGround: update.qtyGround, qtyUpstair: update.qtyUpstair, qtyBox: update.qtyBox, updatedAt: now() });
        return saved;
      });
      if (!saved) throw new Error('InventoryItem not found: ' + update.id);
      return saved;
    },

    // ── Summary / reporting ───────────────────────────────────────────────────
    getInventorySummary: (token): InventorySummary => {
      userFor(token);
      return {
        totalCost:     inventory.reduce((s, i) => s + i.costTotal, 0),
        totalQty:      inventory.reduce((s, i) => s + i.qtyTotal, 0),
        categoryCount: categories.length,
        skuCount:      inventory.length,
        mismatchCount: inventory.filter((i) => !i.kyteMatch).length,
        zeroStockCount:inventory.filter((i) => i.qtyTotal === 0).length,
      };
    },
    getCategoryTotals: (token): CategoryTotal[] => {
      userFor(token);
      return categories.map((cat) => {
        const its = inventory.filter((i) => i.categoryId === cat.id);
        return {
          categoryId:   cat.id,
          categoryCode: cat.code,
          categoryName: cat.name,
          totalCost:    its.reduce((s, i) => s + i.costTotal, 0),
          totalQty:     its.reduce((s, i) => s + i.qtyTotal, 0),
          skuCount:     its.length,
        };
      });
    },

    // ── Data management ───────────────────────────────────────────────────────
    reseedInventory: (token) => {
      requireRole(token, 'supervisor');
      inventory  = [];
      categories = [];
      return { categories: 0, items: 0 };
    },
  };
};
