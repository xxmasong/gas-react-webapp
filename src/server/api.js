/**
 * Public RPC API — top-level named functions called from the React client via
 * gas-client (google.script.run).
 *
 * P0b: every function routes through Kernel.Gateway.handle, which uniformly
 * applies a requestId, auth (requireRole/requireUser), error normalization, and
 * — for mutations — an append-only audit_logs row (actor, before/after,
 * requestId). The gateway returns each delegate's value UNCHANGED, so the client
 * contract (names, args, return shapes) is identical to before.
 *
 *   ctx.audit PRESENT  => mutation, audited
 *   ctx.audit ABSENT   => read, not audited
 *   ctx.role  PRESENT  => requireRole; ABSENT => requireUser
 *
 * login() is the only function that bypasses the gateway (unauthenticated).
 *
 * Keep signatures in sync with ServerFunctions in src/shared/types.ts.
 */

function _getRole() { return Kernel.Config.ROLES; }

// ─── Auth ────────────────────────────────────────────────────────────────────

/** @returns {{token, user, expiresAt}} — unauthenticated, bypasses the gateway. */
function login(username, password) {
  validate.string(username, 'username');
  validate.string(password, 'password');
  return Kernel.Auth.login(username, password);
}

/** @returns {{ok:true}} */
function logout(token) {
  return Kernel.Gateway.handle(
    { token, action: 'logout', public: true },   // no role check; logout is always allowed
    () => Kernel.Auth.logout(token)
  );
}

/** @returns {Object|null} the current public user, or null if not signed in. */
function me(token) {
  return Kernel.Gateway.handle(
    { token, action: 'me', public: true },        // returns null rather than throwing when expired
    () => Kernel.Auth.me(token)
  );
}

/** @returns {{ok:true}} */
function changeOwnPassword(token, currentPassword, newPassword) {
  return Kernel.Gateway.handle(
    { token, action: 'changeOwnPassword',
      audit: { entity: 'User', op: 'password' } },   // event only — never log password values
    () => Kernel.Auth.changeOwnPassword(token, currentPassword, newPassword)
  );
}

// ─── Admin: user management ────────────────────────────────────────────────────

function listUsers(token) {
  return Kernel.Gateway.handle(
    { token, action: 'listUsers', role: _getRole().ADMIN },
    () => Kernel.Auth.listUsers(token)
  );
}

function registerUser(token, username, password, role) {
  return Kernel.Gateway.handle(
    { token, action: 'registerUser', role: _getRole().ADMIN,
      audit: { entity: 'User', op: 'add', after: (u) => ({ id: u.id, username: u.username, role: u.role }) } },
    () => Kernel.Auth.registerUser(token, username, password, role)
  );
}

function setUserActive(token, userId, active) {
  return Kernel.Gateway.handle(
    { token, action: 'setUserActive', role: _getRole().ADMIN,
      audit: { entity: 'User', op: 'active', recordId: userId } },
    () => Kernel.Auth.setUserActive(token, userId, active)
  );
}

function setUserRole(token, userId, role) {
  return Kernel.Gateway.handle(
    { token, action: 'setUserRole', role: _getRole().ADMIN,
      audit: { entity: 'User', op: 'role', recordId: userId } },
    () => Kernel.Auth.setUserRole(token, userId, role)
  );
}

function deleteUserAccount(token, userId) {
  return Kernel.Gateway.handle(
    { token, action: 'deleteUserAccount', role: _getRole().ADMIN,
      audit: { entity: 'User', op: 'delete', recordId: userId } },
    () => Kernel.Auth.deleteUser(token, userId)
  );
}

// ─── Legacy demo entity (kept; writes require supervisor+) ──────────────────────

function getItems(token) {
  return Kernel.Gateway.handle(
    { token, action: 'getItems', module: 'inventory' },
    () => InventoryService.getItems()
  );
}

function addItem(token, item) {
  return Kernel.Gateway.handle(
    { token, action: 'addItem', module: 'inventory', role: _getRole().SUPERVISOR,
      audit: { entity: 'Item', op: 'add' } },
    () => {
      validate.required(item, 'item');
      validate.string(item.name, 'name');
      validate.nonNegativeNumber(item.quantity, 'quantity');
      return InventoryService.addItem(item);
    }
  );
}

function updateItem(token, item) {
  return Kernel.Gateway.handle(
    { token, action: 'updateItem', module: 'inventory', role: _getRole().SUPERVISOR,
      audit: { entity: 'Item', op: 'update', recordId: item && item.id } },
    () => {
      validate.required(item, 'item');
      validate.string(item.id, 'id');
      validate.string(item.name, 'name');
      validate.nonNegativeNumber(item.quantity, 'quantity');
      return InventoryService.updateItem(item);
    }
  );
}

function deleteItem(token, id) {
  return Kernel.Gateway.handle(
    { token, action: 'deleteItem', module: 'inventory', role: _getRole().SUPERVISOR,
      audit: { entity: 'Item', op: 'delete', recordId: id } },
    () => { validate.string(id, 'id'); return InventoryService.deleteItem(id); }
  );
}

// ─── Categories (read: any user · write: supervisor+) ───────────────────────────

function getCategories(token) {
  return Kernel.Gateway.handle(
    { token, action: 'getCategories', module: 'inventory' },
    () => CategoryService.getCategories()
  );
}

function addCategory(token, cat) {
  return Kernel.Gateway.handle(
    { token, action: 'addCategory', module: 'inventory', role: _getRole().SUPERVISOR,
      audit: { entity: 'Category', op: 'add' } },
    () => { validate.category(cat); return CategoryService.addCategory(cat); }
  );
}

function updateCategory(token, cat) {
  return Kernel.Gateway.handle(
    { token, action: 'updateCategory', module: 'inventory', role: _getRole().SUPERVISOR,
      audit: { entity: 'Category', op: 'update', recordId: cat && cat.id,
               before: () => CategoryService.getCategory(cat.id) } },
    () => {
      validate.category(cat);
      validate.string(cat.id, 'id');
      return CategoryService.updateCategory(cat);
    }
  );
}

function deleteCategory(token, id) {
  return Kernel.Gateway.handle(
    { token, action: 'deleteCategory', module: 'inventory', role: _getRole().SUPERVISOR,
      audit: { entity: 'Category', op: 'delete', recordId: id,
               before: () => CategoryService.getCategory(id) } },
    () => { validate.string(id, 'id'); return CategoryService.deleteCategory(id); }
  );
}

// ─── Inventory items (read: any · stock counts: staff+ · SKU edits: supervisor+) ──

function getInventoryItems(token, categoryId) {
  return Kernel.Gateway.handle(
    { token, action: 'getInventoryItems', module: 'inventory' },
    () => InventoryItemService.getInventoryItems(categoryId)
  );
}

function addInventoryItem(token, item) {
  return Kernel.Gateway.handle(
    { token, action: 'addInventoryItem', module: 'inventory', role: _getRole().SUPERVISOR,
      audit: { entity: 'InventoryItem', op: 'add' } },
    () => { validate.inventoryItem(item); return InventoryItemService.addInventoryItem(item); }
  );
}

function updateInventoryItem(token, item) {
  return Kernel.Gateway.handle(
    { token, action: 'updateInventoryItem', module: 'inventory', role: _getRole().SUPERVISOR,
      audit: { entity: 'InventoryItem', op: 'update', recordId: item && item.id,
               before: () => InventoryItemService.getInventoryItem(item.id) } },
    () => {
      validate.inventoryItem(item);
      validate.string(item.id, 'id');
      return InventoryItemService.updateInventoryItem(item);
    }
  );
}

function deleteInventoryItem(token, id) {
  return Kernel.Gateway.handle(
    { token, action: 'deleteInventoryItem', module: 'inventory', role: _getRole().SUPERVISOR,
      audit: { entity: 'InventoryItem', op: 'delete', recordId: id,
               before: () => InventoryItemService.getInventoryItem(id) } },
    () => { validate.string(id, 'id'); return InventoryItemService.deleteInventoryItem(id); }
  );
}

/** Stock-count updates — inventory_staff and above. Bulk: log the set + count. */
function bulkUpdateStock(token, updates) {
  return Kernel.Gateway.handle(
    { token, action: 'bulkUpdateStock', module: 'inventory', role: _getRole().STAFF,
      audit: { entity: 'InventoryItem', op: 'stock-bulk',
               after: (result) => ({ count: (result || []).length, updates: updates }) } },
    () => {
      validate.array(updates, 'updates');
      updates.forEach(function (u) { validate.stockUpdate(u); });
      return InventoryItemService.bulkUpdateStock(updates);
    }
  );
}

/** Save one stock row + verify against the sheet — inventory_staff and above. */
function saveAndVerifyStock(token, update) {
  return Kernel.Gateway.handle(
    { token, action: 'saveAndVerifyStock', module: 'inventory', role: _getRole().STAFF,
      audit: { entity: 'InventoryItem', op: 'stock', recordId: update && update.id,
               before: () => InventoryItemService.getInventoryItem(update.id) } },
    () => { validate.stockUpdate(update); return InventoryItemService.saveAndVerifyStock(update); }
  );
}

// ─── Reseed (supervisor+) ───────────────────────────────────────────────────────

function reseedInventory(token) {
  return Kernel.Gateway.handle(
    { token, action: 'reseedInventory', module: 'inventory', role: _getRole().SUPERVISOR,
      audit: { entity: 'Inventory', op: 'reseed' } },
    () => _reseedBatch()
  );
}

// ─── Summary / reporting (read: any user) ───────────────────────────────────────

function getInventorySummary(token) {
  return Kernel.Gateway.handle(
    { token, action: 'getInventorySummary', module: 'inventory' },
    () => SummaryService.getInventorySummary()
  );
}

function getCategoryTotals(token) {
  return Kernel.Gateway.handle(
    { token, action: 'getCategoryTotals', module: 'inventory' },
    () => SummaryService.getCategoryTotals()
  );
}
