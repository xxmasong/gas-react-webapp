/**
 * Public RPC API — top-level named functions called from the React client via
 * gas-client (google.script.run). Each function is a thin shim: validate args,
 * delegate to InventoryService, return the result.
 *
 * Keep signatures in sync with ServerFunctions in src/shared/types.ts.
 */

/** @returns {Array<Object>} all items. */
function getItems() {
  return InventoryService.getItems();
}

/**
 * @param {{name: string, quantity: number}} item
 * @returns {Object} created item with id + updatedAt.
 */
function addItem(item) {
  validate.required(item, 'item');
  validate.string(item.name, 'name');
  validate.nonNegativeNumber(item.quantity, 'quantity');
  return InventoryService.addItem(item);
}

/**
 * @param {Object} item full item to overwrite (matched by id).
 * @returns {Object} updated item.
 */
function updateItem(item) {
  validate.required(item, 'item');
  validate.string(item.id, 'id');
  validate.string(item.name, 'name');
  validate.nonNegativeNumber(item.quantity, 'quantity');
  return InventoryService.updateItem(item);
}

/**
 * @param {string} id
 * @returns {{id: string}}
 */
function deleteItem(id) {
  validate.string(id, 'id');
  return InventoryService.deleteItem(id);
}

// ─── Categories ────────────────────────────────────────────────────────────────

/** @returns {Array<Object>} all categories sorted by sortOrder. */
function getCategories() {
  return CategoryService.getCategories();
}

/**
 * @param {Object} cat new category payload.
 * @returns {Object} created category.
 */
function addCategory(cat) {
  validate.category(cat);
  return CategoryService.addCategory(cat);
}

/**
 * @param {Object} cat full category to overwrite (matched by id).
 * @returns {Object} updated category.
 */
function updateCategory(cat) {
  validate.category(cat);
  validate.string(cat.id, 'id');
  return CategoryService.updateCategory(cat);
}

/**
 * @param {string} id
 * @returns {{id: string}}
 */
function deleteCategory(id) {
  validate.string(id, 'id');
  return CategoryService.deleteCategory(id);
}

// ─── Inventory items ─────────────────────────────────────────────────────────────

/**
 * @param {string} [categoryId] optional category filter.
 * @returns {Array<Object>} inventory items.
 */
function getInventoryItems(categoryId) {
  return InventoryItemService.getInventoryItems(categoryId);
}

/**
 * @param {Object} item new SKU payload.
 * @returns {Object} created item with computed fields.
 */
function addInventoryItem(item) {
  validate.inventoryItem(item);
  return InventoryItemService.addInventoryItem(item);
}

/**
 * @param {Object} item full SKU to overwrite (matched by id).
 * @returns {Object} updated item with recomputed fields.
 */
function updateInventoryItem(item) {
  validate.inventoryItem(item);
  validate.string(item.id, 'id');
  return InventoryItemService.updateInventoryItem(item);
}

/**
 * @param {string} id
 * @returns {{id: string}}
 */
function deleteInventoryItem(id) {
  validate.string(id, 'id');
  return InventoryItemService.deleteInventoryItem(id);
}

/**
 * @param {Array<Object>} updates [{ id, qtyGround, qtyUpstair, qtyBox }]
 * @returns {Array<Object>} updated items.
 */
function bulkUpdateStock(updates) {
  validate.array(updates, 'updates');
  updates.forEach(function (u) { validate.stockUpdate(u); });
  return InventoryItemService.bulkUpdateStock(updates);
}

// ─── Summary / reporting ─────────────────────────────────────────────────────────

/** @returns {Object} aggregate inventory summary. */
function getInventorySummary() {
  return SummaryService.getInventorySummary();
}

/** @returns {Array<Object>} per-category totals. */
function getCategoryTotals() {
  return SummaryService.getCategoryTotals();
}
