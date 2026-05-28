/**
 * ONE-TIME MIGRATION — run manually from the Apps Script editor, never on a timer.
 *
 * Reads the source "Product Info" sheet and seeds the SkuCategories +
 * InventoryItems tabs in THIS spreadsheet. Safe to re-run only after clearing
 * the target tabs (see resetSeededTabs). It refuses to run if the target
 * already contains data, to avoid duplicate rows.
 *
 * Source layout (Product Info, gid=1625801440) — a clean tabular sheet where
 * EVERY row is a SKU (there are no interleaved category-header rows). Columns:
 *
 *   STORE | CATEGORY | GROUP | PRODUCT | STOCKEEPING | UOM |
 *   COST PER BOX (New) | COST PER PIECE (New) | COST PER PIECE (Old) |
 *   SELLING PRICE (WholeSale) | SELLING PRICE (Dealer) | SELLING PRICE (SRP) |
 *   QTY GROUND | EXPIRY (Ground) | QTY UPSTAIRS | EXPIRY (Upstairs) |
 *   QTY BOXES | EXPIRY (Boxes) | TOTAL COST | TOTAL QTY | POS COUNT | DISCREPANCY
 *
 * Categories are DERIVED from the (CATEGORY, GROUP) pairs found in the data —
 * not hardcoded — so new categories (ARMANDO, SACHET, INGREDIENTS, …) are
 * picked up automatically. Columns are resolved by header text, not position.
 */

var SOURCE_SPREADSHEET_ID = '1D_tPksBpflSUD2Hx4I_MYHPQL2yYz_V-c-1uVkkaaIo';
var SOURCE_SHEET_GID      = 1625801440;

// Column resolution by header text. Headers are normalized first: newlines/tabs
// collapse to single spaces, lowercased. `match: 'eq'` requires the whole cell
// to equal a hint (use for short headers that would substring-collide).
var HEADER_HINTS = {
  store:                 { hints: ['store'], match: 'eq' },
  category:              { hints: ['category'], match: 'eq' },
  group:                 { hints: ['group'], match: 'eq' },
  product:               { hints: ['product'], match: 'eq' },
  stockeeping:           { hints: ['stockeeping', 'stocking', 'stock keeping'] },
  uom:                   { hints: ['uom'], match: 'eq' },
  costPerBoxNew:         { hints: ['cost per box'] },
  costPerPieceNew:       { hints: ['cost per piece (new)'] },
  costPerPieceOld:       { hints: ['cost per piece (old)'] },
  sellingPriceWholesale: { hints: ['wholesale'] },
  sellingPriceDealer:    { hints: ['dealer'] },
  sellingPriceSrp:       { hints: ['srp'] },
  qtyGround:             { hints: ['qty ground'] },
  expiryGround:          { hints: ['expiry (ground)'] },
  qtyUpstair:            { hints: ['qty upstairs', 'qty upstair'] },
  expiryUpstair:         { hints: ['expiry (upstairs)', 'expiry (upstair)'] },
  qtyBox:                { hints: ['qty boxes', 'qty box'] },
  expiryBox:             { hints: ['expiry (boxes)', 'expiry (box)'] },
  posCount:              { hints: ['pos count'] },
};

function _norm(v) {
  return String(v == null ? '' : v)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function _resolveColumns(headerRow) {
  var cols = {};
  for (var field in HEADER_HINTS) {
    var spec  = HEADER_HINTS[field];
    var hints = spec.hints;
    var eq    = spec.match === 'eq';
    for (var c = 0; c < headerRow.length; c++) {
      var cell = _norm(headerRow[c]);
      if (!cell) continue;
      for (var h = 0; h < hints.length; h++) {
        var hit = eq ? (cell === hints[h]) : (cell.indexOf(hints[h]) !== -1);
        if (hit) { cols[field] = c; break; }
      }
      if (cols[field] != null) break;
    }
  }
  return cols;
}

// Use the raw GROUP cell as the category code, trimmed.
// Fall back to the CATEGORY name (trimmed) when GROUP is blank.
// Strip trailing pipe characters that appear in some GROUP cells (e.g. "Easy r3e |").
function _deriveCode(groupCell, categoryName) {
  var g = String(groupCell == null ? '' : groupCell).replace(/\|/g, '').trim();
  return g || String(categoryName == null ? '' : categoryName).trim() || 'uncategorized';
}

function _leadingEmoji(name) {
  var m = String(name).match(/^([^\w\s]+)/u);
  return m ? m[1].trim() : '';
}

function _store(v) {
  return _norm(v) === 'gruton' ? 'GRUTON' : 'EASY';
}

/** Run this once from the editor. */
function seedInventoryFromSheet() {
  var existing = InventoryItemRepository.findAll();
  if (existing.length > 0) {
    throw new Error('InventoryItems already has ' + existing.length + ' rows. Run resetSeededTabs first.');
  }

  var sheet  = _openSourceSheet();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('Source sheet appears empty.');

  var cols = _resolveColumns(values[0]);
  console.log('Resolved columns: ' + JSON.stringify(cols));
  if (cols.product == null) throw new Error('Could not locate the PRODUCT column in the source header.');
  if (cols.group == null && cols.category == null) {
    throw new Error('Could not locate a GROUP or CATEGORY column to derive categories from.');
  }

  function pick(row, field) {
    var idx = cols[field];
    return idx == null ? '' : row[idx];
  }

  // Pass 1: discover categories from (CATEGORY, GROUP) pairs in row order.
  var codeToId   = {};
  var sortOrder  = 0;
  for (var r = 1; r < values.length; r++) {
    var name = String(pick(values[r], 'product') || '').trim();
    if (!name) continue;
    var catName = String(pick(values[r], 'category') || '').trim();
    var code    = _deriveCode(pick(values[r], 'group'), catName);
    if (codeToId[code]) continue;
    var created = CategoryService.addCategory({
      code:           code,
      name:           catName || code,
      packConstraint: String(pick(values[r], 'stockeeping') || '').trim(),
      sortOrder:      ++sortOrder,
    });
    codeToId[code] = created.id;
  }
  console.log('Seeded ' + sortOrder + ' categories.');

  // Pass 2: write every SKU row under its category.
  var itemsWritten = 0;
  for (var i = 1; i < values.length; i++) {
    var row  = values[i];
    var prod = String(pick(row, 'product') || '').trim();
    if (!prod) continue;

    var cName = String(pick(row, 'category') || '').trim();
    var cCode = _deriveCode(pick(row, 'group'), cName);
    var catId = codeToId[cCode];
    if (!catId) continue; // shouldn't happen — pass 1 created them all

    // SRP column doubles as the "selling price (piece)" reference.
    var srp = Number(pick(row, 'sellingPriceSrp')) || 0;

    InventoryItemService.addInventoryItem({
      categoryId:            catId,
      store:                 _store(pick(row, 'store')),
      sku:                   prod,
      emoji:                 _leadingEmoji(prod),
      uom:                   Number(pick(row, 'uom')) || 1,
      costPerBoxNew:         Number(pick(row, 'costPerBoxNew')) || 0,
      costPerPieceNew:       Number(pick(row, 'costPerPieceNew')) || 0,
      costPerPieceOld:       Number(pick(row, 'costPerPieceOld')) || 0,
      sellingPriceWholesale: Number(pick(row, 'sellingPriceWholesale')) || 0,
      sellingPriceDealer:    Number(pick(row, 'sellingPriceDealer')) || 0,
      sellingPricePiece:     srp,
      srp:                   srp,
      qtyGround:             Number(pick(row, 'qtyGround')) || 0,
      expiryGround:          _dateCell(pick(row, 'expiryGround')),
      qtyUpstair:            Number(pick(row, 'qtyUpstair')) || 0,
      expiryUpstair:         _dateCell(pick(row, 'expiryUpstair')),
      qtyBox:                Number(pick(row, 'qtyBox')) || 0,
      expiryBox:             _dateCell(pick(row, 'expiryBox')),
      qtyKyte:               Number(pick(row, 'posCount')) || 0,
    });
    itemsWritten++;
  }

  console.log('Seed complete: ' + sortOrder + ' categories, ' + itemsWritten + ' items written.');
}

// Expiry cells may be blank, a day-count number, or a Date. Keep ISO dates;
// drop everything else to '' (the model treats expiry as an optional ISO date).
function _dateCell(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  }
  return '';
}

function _openSourceSheet() {
  var src    = SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);
  var sheets = src.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    if (sheets[s].getSheetId() === SOURCE_SHEET_GID) return sheets[s];
  }
  return src.getSheets()[0];
}

/**
 * Preview the migration WITHOUT writing anything. Logs the resolved column map,
 * the categories it would create, and a per-category SKU count + store split.
 * Run this first to confirm parsing is correct.
 */
function dryRunInventorySeed() {
  var sheet  = _openSourceSheet();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('Source sheet appears empty.');

  var cols = _resolveColumns(values[0]);
  console.log('Header row (normalized): ' + JSON.stringify(values[0].map(_norm)));
  console.log('Resolved columns: ' + JSON.stringify(cols));

  function pick(row, field) {
    var idx = cols[field];
    return idx == null ? '' : row[idx];
  }

  var cats     = {};     // code -> { name, count, easy, gruton }
  var order    = [];
  var skuCount = 0;

  for (var r = 1; r < values.length; r++) {
    var prod = String(pick(values[r], 'product') || '').trim();
    if (!prod) continue;
    var cName = String(pick(values[r], 'category') || '').trim();
    var code  = _deriveCode(pick(values[r], 'group'), cName);
    if (!cats[code]) {
      cats[code] = { name: cName || code, count: 0, easy: 0, gruton: 0 };
      order.push(code);
    }
    cats[code].count++;
    if (_store(pick(values[r], 'store')) === 'GRUTON') cats[code].gruton++; else cats[code].easy++;
    skuCount++;
  }

  console.log('Would create ' + order.length + ' categories from ' + skuCount + ' SKU rows:');
  order.forEach(function (code) {
    var c = cats[code];
    console.log('  [' + code + '] ' + c.name + ' — ' + c.count + ' SKUs (EASY ' + c.easy + ', GRUTON ' + c.gruton + ')');
  });
  console.log('(dry run — nothing written)');
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
