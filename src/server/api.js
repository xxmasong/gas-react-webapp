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
