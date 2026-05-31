// Typed RPC bridge to the Apps Script backend.
//
// In production (running inside the GAS iframe) it delegates to the real
// server functions via gas-client. During local `vite dev` it falls back to
// an in-memory mock so the UI can be developed without a live deployment.
//
// AUTH: every data function on the server takes the session token as its first
// argument. This bridge injects it automatically from tokenStore so view/hook
// code never passes it manually.

import { GASClient } from 'gas-client';
import type {
  Item, NewItem,
  SkuCategory, NewSkuCategory,
  InventoryItem, NewInventoryItem, StockUpdate,
  ServerFunctions, Role,
} from '@shared/types';
import { getToken } from './tokenStore';
import { createMock } from './serverMock';

export { setToken, getToken } from './tokenStore';

// ─── Environment detection ───────────────────────────────────────────────────

export const runningInGas =
  typeof google !== 'undefined' && typeof google?.script !== 'undefined';

// ─── Backend selection ───────────────────────────────────────────────────────

const real: ServerFunctions | null = runningInGas
  ? (new GASClient().serverFunctions as unknown as ServerFunctions)
  : null;

const mock: ServerFunctions | null = runningInGas ? null : createMock();

// ─── RPC primitives ──────────────────────────────────────────────────────────

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

// Inject the current session token as the first argument of any authed call.
function authed<K extends keyof ServerFunctions>(
  name: K,
  ...rest: unknown[]
): Promise<ReturnType<ServerFunctions[K]>> {
  return call(name, ...([getToken(), ...rest] as Parameters<ServerFunctions[K]>));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const server = {
  // Auth (login is unauthenticated; all others inject the token)
  login:              (username: string, password: string) => call('login', username, password),
  logout:             ()                                   => authed('logout'),
  me:                 ()                                   => authed('me'),
  changeOwnPassword:  (cur: string, next: string)          => authed('changeOwnPassword', cur, next),

  // User management (admin)
  listUsers:          ()                                           => authed('listUsers'),
  registerUser:       (username: string, password: string, role: Role) => authed('registerUser', username, password, role),
  setUserActive:      (userId: string, active: boolean)            => authed('setUserActive', userId, active),
  setUserRole:        (userId: string, role: Role)                 => authed('setUserRole', userId, role),
  deleteUserAccount:  (userId: string)                             => authed('deleteUserAccount', userId),

  // Legacy items
  getItems:    ()              => authed('getItems'),
  addItem:     (item: NewItem) => authed('addItem', item),
  updateItem:  (item: Item)    => authed('updateItem', item),
  deleteItem:  (id: string)    => authed('deleteItem', id),

  // Categories
  getCategories:    ()                       => authed('getCategories'),
  addCategory:      (cat: NewSkuCategory)    => authed('addCategory', cat),
  updateCategory:   (cat: SkuCategory)       => authed('updateCategory', cat),
  deleteCategory:   (id: string)             => authed('deleteCategory', id),

  // Inventory items
  getInventoryItems:    (categoryId?: string)      => authed('getInventoryItems', categoryId),
  addInventoryItem:     (item: NewInventoryItem)   => authed('addInventoryItem', item),
  updateInventoryItem:  (item: InventoryItem)      => authed('updateInventoryItem', item),
  deleteInventoryItem:  (id: string)               => authed('deleteInventoryItem', id),
  bulkUpdateStock:      (updates: StockUpdate[])   => authed('bulkUpdateStock', updates),
  saveAndVerifyStock:   (update: StockUpdate)      => authed('saveAndVerifyStock', update),

  // Summary / reporting
  getInventorySummary:  () => authed('getInventorySummary'),
  getCategoryTotals:    () => authed('getCategoryTotals'),

  // Data management
  reseedInventory: () => authed('reseedInventory'),
};
