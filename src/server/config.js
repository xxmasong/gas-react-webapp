/**
 * Inventory module configuration.
 *
 * Auth/role/session config moved to the Kernel (Kernel.Config). This file holds
 * ONLY Inventory-specific config: sheet/tab names, cache TTLs/keys, store codes.
 *
 * Sheet IDs that differ per deployment live in Script Properties, not here.
 */

var Config = (function () {

  // ── Sheets / tab names (Inventory data) ──────────────────────────────────────
  var SHEETS = {
    items:          'Items',
    categories:     'SkuCategories',
    inventoryItems: 'InventoryItems',
  };

  // ── Cache TTLs (seconds) ─────────────────────────────────────────────────────
  var CACHE_TTL = {
    items:          300,   // 5 minutes
    categories:     300,   // 5 minutes
    inventoryItems: 120,   // 2 minutes (higher write frequency)
  };

  // ── Cache keys ───────────────────────────────────────────────────────────────
  var CACHE_KEYS = {
    items:          'items_all',
    categories:     'categories_all',
    inventoryItems: 'inventory_items_all',
  };

  // ── Valid store codes ────────────────────────────────────────────────────────
  var STORES = ['EASY', 'GRUTON'];

  // Default store applied when the source value is unrecognised.
  var DEFAULT_STORE = STORES[0];

  // Roles are owned by the Kernel; expose a convenience alias so Inventory code
  // can read Config.ROLES exactly as before (now sourced from Kernel.Config).
  var ROLES = Kernel.Config.ROLES;

  return {
    SHEETS:        SHEETS,
    CACHE_TTL:     CACHE_TTL,
    CACHE_KEYS:    CACHE_KEYS,
    STORES:        STORES,
    DEFAULT_STORE: DEFAULT_STORE,
    ROLES:         ROLES,
  };

})();
