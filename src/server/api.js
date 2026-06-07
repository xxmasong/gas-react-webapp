/**
 * Public RPC API — top-level named functions called from the React client via
 * gas-client (google.script.run). Each function is a thin shim that:
 *   1. validates the session token + role (server-side authorization),
 *   2. validates arguments,
 *   3. delegates to a service, and returns the result.
 *
 * AUTHORIZATION MODEL — every data function takes the session `token` as its
 * first argument. Read endpoints require any signed-in user; stock-count
 * updates require inventory_staff+; SKU/category/price edits and reseed require
 * supervisor+; user management requires admin. Hiding controls in the UI is a
 * convenience only — these server checks are the real enforcement.
 *
 * Keep signatures in sync with ServerFunctions in src/shared/types.ts.
 */

function _getRole() { return Config.ROLES; }

// ─── Auth ────────────────────────────────────────────────────────────────────

/** @returns {{token, user, expiresAt}} */
function login(username, password) {
  validate.string(username, 'username');
  validate.string(password, 'password');
  return Kernel.Auth.login(username, password);
}

/** @returns {{ok:true}} */
function logout(token) {
  return Kernel.Auth.logout(token);
}

/** @returns {Object|null} the current public user, or null if not signed in. */
function me(token) {
  return Kernel.Auth.me(token);
}

/** @returns {{ok:true}} */
function changeOwnPassword(token, currentPassword, newPassword) {
  return Kernel.Auth.changeOwnPassword(token, currentPassword, newPassword);
}

// ─── Admin: user management ────────────────────────────────────────────────────

function listUsers(token) {
  return Kernel.Auth.listUsers(token);
}

function registerUser(token, username, password, role) {
  return Kernel.Auth.registerUser(token, username, password, role);
}

function setUserActive(token, userId, active) {
  return Kernel.Auth.setUserActive(token, userId, active);
}

function setUserRole(token, userId, role) {
  return Kernel.Auth.setUserRole(token, userId, role);
}

function deleteUserAccount(token, userId) {
  return Kernel.Auth.deleteUser(token, userId);
}

// ─── Legacy demo entity (kept; writes require supervisor+) ──────────────────────

function getItems(token) {
  Kernel.Auth.requireUser(token);
  return InventoryService.getItems();
}

function addItem(token, item) {
  Kernel.Auth.requireRole(token, _getRole().SUPERVISOR);
  validate.required(item, 'item');
  validate.string(item.name, 'name');
  validate.nonNegativeNumber(item.quantity, 'quantity');
  return InventoryService.addItem(item);
}

function updateItem(token, item) {
  Kernel.Auth.requireRole(token, _getRole().SUPERVISOR);
  validate.required(item, 'item');
  validate.string(item.id, 'id');
  validate.string(item.name, 'name');
  validate.nonNegativeNumber(item.quantity, 'quantity');
  return InventoryService.updateItem(item);
}

function deleteItem(token, id) {
  Kernel.Auth.requireRole(token, _getRole().SUPERVISOR);
  validate.string(id, 'id');
  return InventoryService.deleteItem(id);
}

// ─── Categories (read: any user · write: supervisor+) ───────────────────────────

function getCategories(token) {
  Kernel.Auth.requireUser(token);
  return CategoryService.getCategories();
}

function addCategory(token, cat) {
  Kernel.Auth.requireRole(token, _getRole().SUPERVISOR);
  validate.category(cat);
  return CategoryService.addCategory(cat);
}

function updateCategory(token, cat) {
  Kernel.Auth.requireRole(token, _getRole().SUPERVISOR);
  validate.category(cat);
  validate.string(cat.id, 'id');
  return CategoryService.updateCategory(cat);
}

function deleteCategory(token, id) {
  Kernel.Auth.requireRole(token, _getRole().SUPERVISOR);
  validate.string(id, 'id');
  return CategoryService.deleteCategory(id);
}

// ─── Inventory items (read: any · stock counts: staff+ · SKU edits: supervisor+) ──

function getInventoryItems(token, categoryId) {
  Kernel.Auth.requireUser(token);
  return InventoryItemService.getInventoryItems(categoryId);
}

function addInventoryItem(token, item) {
  Kernel.Auth.requireRole(token, _getRole().SUPERVISOR);
  validate.inventoryItem(item);
  return InventoryItemService.addInventoryItem(item);
}

function updateInventoryItem(token, item) {
  Kernel.Auth.requireRole(token, _getRole().SUPERVISOR);
  validate.inventoryItem(item);
  validate.string(item.id, 'id');
  return InventoryItemService.updateInventoryItem(item);
}

function deleteInventoryItem(token, id) {
  Kernel.Auth.requireRole(token, _getRole().SUPERVISOR);
  validate.string(id, 'id');
  return InventoryItemService.deleteInventoryItem(id);
}

/** Stock-count updates — inventory_staff and above. */
function bulkUpdateStock(token, updates) {
  Kernel.Auth.requireRole(token, _getRole().STAFF);
  validate.array(updates, 'updates');
  updates.forEach(function (u) { validate.stockUpdate(u); });
  return InventoryItemService.bulkUpdateStock(updates);
}

/** Save one stock row + verify against the sheet — inventory_staff and above. */
function saveAndVerifyStock(token, update) {
  Kernel.Auth.requireRole(token, _getRole().STAFF);
  validate.stockUpdate(update);
  return InventoryItemService.saveAndVerifyStock(update);
}

// ─── Reseed (supervisor+) ───────────────────────────────────────────────────────

function reseedInventory(token) {
  Kernel.Auth.requireRole(token, _getRole().SUPERVISOR);
  return _reseedBatch();
}

// ─── Summary / reporting (read: any user) ───────────────────────────────────────

function getInventorySummary(token) {
  Kernel.Auth.requireUser(token);
  return SummaryService.getInventorySummary();
}

function getCategoryTotals(token) {
  Kernel.Auth.requireUser(token);
  return SummaryService.getCategoryTotals();
}
