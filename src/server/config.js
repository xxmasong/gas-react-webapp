/**
 * Central configuration for the Apps Script server.
 *
 * Sheet IDs that differ per deployment (SOURCE_SPREADSHEET_ID, the auth
 * workbook) are NOT hardcoded here — they live in Script Properties and
 * are documented in .env.example at the repo root.
 *
 * Everything that IS here is config that may need tuning without touching
 * business-logic files: sheet/tab names, cache TTLs, auth policy values,
 * valid store codes.
 */

var Config = (function () {

  // ── Sheets / tab names ───────────────────────────────────────────────────────
  var SHEETS = {
    items:         'Items',
    categories:    'SkuCategories',
    inventoryItems:'InventoryItems',
    // Auth workbook sheet names (workbook ID stored in Script Properties)
    users:         'Users',
    sessions:      'Sessions',
  };

  // Name used when auto-creating the auth workbook for the first time.
  var AUTH_WORKBOOK_NAME = 'Inventory Auth (do not share)';

  // Script Property key that holds the auth workbook's spreadsheet ID.
  var AUTH_SPREADSHEET_ID_PROP = 'AUTH_SPREADSHEET_ID';

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

  // ── Auth policy ──────────────────────────────────────────────────────────────
  var AUTH = {
    idleTtlMs:     2  * 60 * 60 * 1000,   // 2 h  — sliding inactivity window
    absoluteTtlMs: 12 * 60 * 60 * 1000,   // 12 h — hard session cap
    minPassword:   10,                     // minimum password length
    maxFails:      5,                      // login failures before lockout
    windowMs:      15 * 60 * 1000,         // failure counting window
    lockoutMs:     15 * 60 * 1000,         // lockout duration after threshold
  };

  // ── Valid store codes ────────────────────────────────────────────────────────
  // Authoritative list — validate.js and inventoryItemService.js read from here.
  var STORES = ['EASY', 'GRUTON'];

  // Default store applied when the source value is unrecognised.
  var DEFAULT_STORE = STORES[0];

  // ── Roles ────────────────────────────────────────────────────────────────────
  var ROLES = {
    STAFF:      'inventory_staff',
    SUPERVISOR: 'supervisor',
    ADMIN:      'admin',
  };

  return {
    SHEETS:                    SHEETS,
    AUTH_WORKBOOK_NAME:        AUTH_WORKBOOK_NAME,
    AUTH_SPREADSHEET_ID_PROP:  AUTH_SPREADSHEET_ID_PROP,
    CACHE_TTL:                 CACHE_TTL,
    CACHE_KEYS:                CACHE_KEYS,
    AUTH:                      AUTH,
    STORES:                    STORES,
    DEFAULT_STORE:             DEFAULT_STORE,
    ROLES:                     ROLES,
  };

})();
