/**
 * ONE-TIME MIGRATION — run manually from the Apps Script editor, never on a timer.
 *
 * Reads the source "Inventory" workbook and seeds the SkuCategories +
 * InventoryItems tabs in THIS spreadsheet. Safe to re-run only after clearing
 * the target tabs (see resetSeededTabs). It refuses to run if the target
 * already contains data, to avoid duplicate rows.
 *
 * Source layout assumptions (see docs/INVENTORY_SHEET_ANALYSIS.md):
 *   - One sheet acts as a ledger of category-header rows + SKU rows.
 *   - Category-header rows carry a "CODE | Easy <code>" marker in the
 *     SKU/Items column; we match against CATEGORY_SEEDS by code.
 *   - SKU rows carry a name in the SKU/Items column and numeric cost/qty cells.
 *
 * Because exported column positions vary, this script resolves columns by
 * reading the header row rather than hardcoding indexes. Adjust HEADER_HINTS
 * if the source headers differ.
 */

var SOURCE_SPREADSHEET_ID = '1D_tPksBpflSUD2Hx4I_MYHPQL2yYz_V-c-1uVkkaaIo';
var SOURCE_SHEET_GID      = 1945163577;

var CATEGORY_SEEDS = [
  { code: 'r1f',     name: 'Syrups',             packConstraint: 'Syrup 2.5kg - 6pc max', sortOrder: 1 },
  { code: 'r1d',     name: 'Drizzle',             packConstraint: 'DRIZZLE 2.5kgx6',       sortOrder: 2 },
  { code: 'r2pb',    name: 'Powder Base',         packConstraint: 'Powder 1kg - 4pc max',  sortOrder: 3 },
  { code: 'r2ss',    name: 'Soft Serve Base',     packConstraint: '',                      sortOrder: 4 },
  { code: 'r3e',     name: 'Essential',           packConstraint: '',                      sortOrder: 5 },
  { code: 'r3et',    name: 'Toppings',            packConstraint: '',                      sortOrder: 6 },
  { code: 'r3ets',   name: 'Sinkers',             packConstraint: '',                      sortOrder: 7 },
  { code: 'r3p',     name: 'Syrup Pump',          packConstraint: '',                      sortOrder: 8 },
  { code: 'sy',      name: 'Sig. Syrup',          packConstraint: 'Syrup 1kg - 8pc max',   sortOrder: 9 },
  { code: 'sa',      name: 'Sig. Sauces',         packConstraint: 'Sauce - 6pc max',       sortOrder: 10 },
  { code: 'sp',      name: 'Sig. Powder Base',    packConstraint: '',                      sortOrder: 11 },
  { code: 'pcd',     name: 'Cheese Sauce Dip',    packConstraint: '',                      sortOrder: 12 },
  { code: 'pfd100',  name: 'Fries Powder 100g',   packConstraint: '',                      sortOrder: 13 },
  { code: 'pfd250',  name: 'Fries Powder 250g',   packConstraint: '',                      sortOrder: 14 },
  { code: 'ppm',     name: 'Powder Mix',          packConstraint: '',                      sortOrder: 15 },
  { code: 'pps',     name: 'Premium Sauces',      packConstraint: 'Sauce - 6pc max',       sortOrder: 16 },
  { code: 'sparkle', name: 'Sparkle & Shimmer',   packConstraint: '',                      sortOrder: 17 },
  { code: 'hgba',    name: 'Anchor',              packConstraint: '',                      sortOrder: 18 },
  { code: 'hgbb',    name: 'Beryls',              packConstraint: '',                      sortOrder: 19 },
  { code: 'hgbs',    name: 'Speculoos',           packConstraint: '',                      sortOrder: 20 },
  { code: 'hgcm',    name: 'Milk',                packConstraint: '',                      sortOrder: 21 },
  { code: 'hgccb',   name: 'Coffee Beans',        packConstraint: '',                      sortOrder: 22 },
  { code: 'hgcc',    name: 'Cones',               packConstraint: '',                      sortOrder: 23 },
  { code: 'hgcd',    name: 'Dairy',               packConstraint: '',                      sortOrder: 24 },
  { code: 'hgcf',    name: 'Frozen Goods',        packConstraint: '',                      sortOrder: 25 },
  { code: 'hgct',    name: 'Toppers & Sinkers',   packConstraint: '',                      sortOrder: 26 },
  { code: 'hgdpa',   name: 'Paper Products',      packConstraint: '',                      sortOrder: 27 },
  { code: 'hgdsw',   name: 'Straws',              packConstraint: '',                      sortOrder: 28 },
  { code: 'hgdpcl',  name: 'Plastic Cups & Lids', packConstraint: '',                      sortOrder: 29 },
  { code: 'hgdpo',   name: 'Organizers',          packConstraint: '',                      sortOrder: 30 },
  { code: 'hgdpl',   name: 'Micro Containers',    packConstraint: '',                      sortOrder: 31 },
  { code: 'hgdso',   name: 'Styro Products',      packConstraint: '',                      sortOrder: 32 },
  { code: 'hges',    name: 'Supplies',            packConstraint: '',                      sortOrder: 33 },
  { code: 'hgoj',    name: 'Jam',                 packConstraint: '',                      sortOrder: 34 },
  { code: 'hgo',     name: 'Others',              packConstraint: '',                      sortOrder: 35 },
  { code: 'hgto',    name: 'Torani',              packConstraint: '',                      sortOrder: 36 },
];

// Substrings used to locate the source columns from its header row.
var HEADER_HINTS = {
  costPerBoxNew:         ['cost per box'],
  costPerPieceNew:       ['cost per piece (new)', 'cost per piece(new)'],
  costPerPieceOld:       ['cost per piece (old)', 'cost per piece(old)'],
  uom:                   ['uom'],
  qtyGround:             ['piece ground', 'ground'],
  qtyUpstair:            ['piece upstair', 'upstair'],
  qtyBox:                ['box'],
  sku:                   ['sku / items', 'sku/items', 'sku', 'items'],
  qtyKyte:               ['kyte'],
  sellingPriceWholesale: ['wholesale'],
  sellingPriceDealer:    ['dealer'],
  sellingPricePiece:     ['selling price\n(piece)', 'selling price (piece)'],
  srp:                   ['srp'],
};

function _norm(v) { return String(v == null ? '' : v).trim().toLowerCase(); }

function _resolveColumns(headerRow) {
  var cols = {};
  for (var field in HEADER_HINTS) {
    var hints = HEADER_HINTS[field];
    for (var c = 0; c < headerRow.length; c++) {
      var cell = _norm(headerRow[c]);
      if (!cell) continue;
      for (var h = 0; h < hints.length; h++) {
        if (cell.indexOf(hints[h]) !== -1) { cols[field] = c; break; }
      }
      if (cols[field] != null) break;
    }
  }
  return cols;
}

function _categoryByCodeMarker(text) {
  // Header cells look like "Syrups | R1f" or "... | Easy r2pb".
  var lower = _norm(text);
  for (var i = 0; i < CATEGORY_SEEDS.length; i++) {
    var code = CATEGORY_SEEDS[i].code.toLowerCase();
    // match " r1f" / "|r1f" / "easy r1f" word boundary-ish
    if (lower.indexOf(' ' + code) !== -1 || lower.indexOf('|' + code) !== -1 ||
        lower.indexOf('easy ' + code) !== -1 || lower.indexOf(code + ' ') === 0) {
      return CATEGORY_SEEDS[i];
    }
  }
  return null;
}

function _leadingEmoji(name) {
  var m = String(name).match(/^([^\w\s]+)/u);
  return m ? m[1].trim() : '';
}

/** Run this once from the editor. */
function seedInventoryFromSheet() {
  var existing = InventoryItemRepository.findAll();
  if (existing.length > 0) {
    throw new Error('InventoryItems already has ' + existing.length + ' rows. Run resetSeededTabs first.');
  }

  var src   = SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);
  var sheets = src.getSheets();
  var sheet  = null;
  for (var s = 0; s < sheets.length; s++) {
    if (sheets[s].getSheetId() === SOURCE_SHEET_GID) { sheet = sheets[s]; break; }
  }
  if (!sheet) sheet = src.getSheets()[0];

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('Source sheet appears empty.');

  var cols = _resolveColumns(values[0]);
  if (cols.sku == null) throw new Error('Could not locate the SKU/Items column in the source header.');

  // Seed all categories first; build code → id map.
  var codeToId = {};
  CATEGORY_SEEDS.forEach(function (seed) {
    var created = CategoryService.addCategory(seed);
    codeToId[seed.code] = created.id;
  });

  var currentCatId = null;
  var itemsWritten = 0;
  var skipped      = 0;

  function pick(row, field) {
    var idx = cols[field];
    return idx == null ? 0 : row[idx];
  }

  for (var r = 1; r < values.length; r++) {
    var row  = values[r];
    var name = String(pick(row, 'sku') || '').trim();
    if (!name) { continue; }

    var cat = _categoryByCodeMarker(name);
    if (cat) { currentCatId = codeToId[cat.code]; continue; }

    if (!currentCatId) { skipped++; continue; }

    InventoryItemService.addInventoryItem({
      categoryId:            currentCatId,
      sku:                   name,
      emoji:                 _leadingEmoji(name),
      uom:                   Number(pick(row, 'uom')) || 1,
      costPerBoxNew:         Number(pick(row, 'costPerBoxNew')) || 0,
      costPerPieceNew:       Number(pick(row, 'costPerPieceNew')) || 0,
      costPerPieceOld:       Number(pick(row, 'costPerPieceOld')) || 0,
      sellingPriceWholesale: Number(pick(row, 'sellingPriceWholesale')) || 0,
      sellingPriceDealer:    Number(pick(row, 'sellingPriceDealer')) || 0,
      sellingPricePiece:     Number(pick(row, 'sellingPricePiece')) || 0,
      srp:                   Number(pick(row, 'srp')) || 0,
      qtyGround:             Number(pick(row, 'qtyGround')) || 0,
      expiryGround:          '',
      qtyUpstair:            Number(pick(row, 'qtyUpstair')) || 0,
      expiryUpstair:         '',
      qtyBox:                Number(pick(row, 'qtyBox')) || 0,
      expiryBox:             '',
      qtyKyte:               Number(pick(row, 'qtyKyte')) || 0,
    });
    itemsWritten++;
  }

  console.log('Seed complete: ' + CATEGORY_SEEDS.length + ' categories, '
    + itemsWritten + ' items written, ' + skipped + ' rows skipped (no category).');
}

/** Clears the seeded tabs so seedInventoryFromSheet can be re-run. */
function resetSeededTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ['InventoryItems', 'SkuCategories'].forEach(function (tab) {
    var sheet = ss.getSheetByName(tab);
    if (sheet) ss.deleteSheet(sheet);
  });
  Cache.remove('inventory_items_all');
  Cache.remove('categories_all');
  console.log('Seeded tabs cleared.');
}
