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

var ROLE = Config.ROLES;

// ─── Auth ────────────────────────────────────────────────────────────────────

/** @returns {{token, user, expiresAt}} */
function login(username, password) {
  validate.string(username, 'username');
  validate.string(password, 'password');
  return AuthService.login(username, password);
}

/** @returns {{ok:true}} */
function logout(token) {
  return AuthService.logout(token);
}

/** @returns {Object|null} the current public user, or null if not signed in. */
function me(token) {
  return AuthService.me(token);
}

/** @returns {{ok:true}} */
function changeOwnPassword(token, currentPassword, newPassword) {
  return AuthService.changeOwnPassword(token, currentPassword, newPassword);
}

// ─── Admin: user management ────────────────────────────────────────────────────

function listUsers(token) {
  return AuthService.listUsers(token);
}

function registerUser(token, username, password, role) {
  return AuthService.registerUser(token, username, password, role);
}

function setUserActive(token, userId, active) {
  return AuthService.setUserActive(token, userId, active);
}

function setUserRole(token, userId, role) {
  return AuthService.setUserRole(token, userId, role);
}

function deleteUserAccount(token, userId) {
  return AuthService.deleteUser(token, userId);
}

// ─── Legacy demo entity (kept; writes require supervisor+) ──────────────────────

function getItems(token) {
  AuthService.requireUser(token);
  return InventoryService.getItems();
}

function addItem(token, item) {
  AuthService.requireRole(token, ROLE.SUPERVISOR);
  validate.required(item, 'item');
  validate.string(item.name, 'name');
  validate.nonNegativeNumber(item.quantity, 'quantity');
  return InventoryService.addItem(item);
}

function updateItem(token, item) {
  AuthService.requireRole(token, ROLE.SUPERVISOR);
  validate.required(item, 'item');
  validate.string(item.id, 'id');
  validate.string(item.name, 'name');
  validate.nonNegativeNumber(item.quantity, 'quantity');
  return InventoryService.updateItem(item);
}

function deleteItem(token, id) {
  AuthService.requireRole(token, ROLE.SUPERVISOR);
  validate.string(id, 'id');
  return InventoryService.deleteItem(id);
}

// ─── Categories (read: any user · write: supervisor+) ───────────────────────────

function getCategories(token) {
  AuthService.requireUser(token);
  return CategoryService.getCategories();
}

function addCategory(token, cat) {
  AuthService.requireRole(token, ROLE.SUPERVISOR);
  validate.category(cat);
  return CategoryService.addCategory(cat);
}

function updateCategory(token, cat) {
  AuthService.requireRole(token, ROLE.SUPERVISOR);
  validate.category(cat);
  validate.string(cat.id, 'id');
  return CategoryService.updateCategory(cat);
}

function deleteCategory(token, id) {
  AuthService.requireRole(token, ROLE.SUPERVISOR);
  validate.string(id, 'id');
  return CategoryService.deleteCategory(id);
}

// ─── Inventory items (read: any · stock counts: staff+ · SKU edits: supervisor+) ──

function getInventoryItems(token, categoryId) {
  AuthService.requireUser(token);
  return InventoryItemService.getInventoryItems(categoryId);
}

function addInventoryItem(token, item) {
  AuthService.requireRole(token, ROLE.SUPERVISOR);
  validate.inventoryItem(item);
  return InventoryItemService.addInventoryItem(item);
}

function updateInventoryItem(token, item) {
  AuthService.requireRole(token, ROLE.SUPERVISOR);
  validate.inventoryItem(item);
  validate.string(item.id, 'id');
  return InventoryItemService.updateInventoryItem(item);
}

function deleteInventoryItem(token, id) {
  AuthService.requireRole(token, ROLE.SUPERVISOR);
  validate.string(id, 'id');
  return InventoryItemService.deleteInventoryItem(id);
}

/** Stock-count updates — inventory_staff and above. */
function bulkUpdateStock(token, updates) {
  AuthService.requireRole(token, ROLE.STAFF);
  validate.array(updates, 'updates');
  updates.forEach(function (u) { validate.stockUpdate(u); });
  return InventoryItemService.bulkUpdateStock(updates);
}

/** Save one stock row + verify against the sheet — inventory_staff and above. */
function saveAndVerifyStock(token, update) {
  AuthService.requireRole(token, ROLE.STAFF);
  validate.stockUpdate(update);
  return InventoryItemService.saveAndVerifyStock(update);
}

// ─── Reseed (supervisor+) ───────────────────────────────────────────────────────

function reseedInventory(token) {
  AuthService.requireRole(token, ROLE.SUPERVISOR);
  return _reseedBatch();
}

// ─── Summary / reporting (read: any user) ───────────────────────────────────────

function getInventorySummary(token) {
  AuthService.requireUser(token);
  return SummaryService.getInventorySummary();
}

function getCategoryTotals(token) {
  AuthService.requireUser(token);
  return SummaryService.getCategoryTotals();
}
