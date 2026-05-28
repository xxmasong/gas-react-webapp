var CategoryRepository = (function () {

  var SHEET_NAME = 'SkuCategories';
  var HEADERS    = ['id', 'code', 'name', 'packConstraint', 'sortOrder', 'updatedAt'];
  var CACHE_KEY  = 'categories_all';

  function getSheet() {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.setFrozenRows(1);
    }
    return sheet;
  }

  function findAll() {
    return Cache.getOrSet(CACHE_KEY, function () {
      var sheet   = getSheet();
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];
      return sheet
        .getRange(2, 1, lastRow - 1, HEADERS.length)
        .getValues()
        .filter(function (row) { return row[0] !== '' && row[0] != null; })
        .map(CategoryMapper.fromRow)
        .sort(function (a, b) { return a.sortOrder - b.sortOrder; });
    }, 300);
  }

  function findById(id) {
    return findAll().find(function (c) { return c.id === String(id); }) || null;
  }

  function findByCode(code) {
    return findAll().find(function (c) { return c.code === String(code); }) || null;
  }

  function findRowIndexById(id) {
    var sheet   = getSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return -1;
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(id)) return i + 2;
    }
    return -1;
  }

  function insert(cat) {
    return Lock.withLock(function () {
      getSheet().appendRow(CategoryMapper.toRow(cat));
      Cache.remove(CACHE_KEY);
      return cat;
    });
  }

  // Write all cats in a single setValues call. Assumes the sheet is empty
  // (header row already present). Does NOT acquire the lock — caller must
  // ensure exclusive access (used only from reseedInventory).
  function insertMany(cats) {
    if (!cats.length) return cats;
    var sheet = getSheet();
    var rows  = cats.map(CategoryMapper.toRow);
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    Cache.remove(CACHE_KEY);
    return cats;
  }

  function update(cat) {
    return Lock.withLock(function () {
      var rowIndex = findRowIndexById(cat.id);
      if (rowIndex === -1) throw AppError.notFound('Category', cat.id);
      getSheet()
        .getRange(rowIndex, 1, 1, HEADERS.length)
        .setValues([CategoryMapper.toRow(cat)]);
      Cache.remove(CACHE_KEY);
      return cat;
    });
  }

  function remove(id) {
    return Lock.withLock(function () {
      var rowIndex = findRowIndexById(id);
      if (rowIndex === -1) throw AppError.notFound('Category', id);
      getSheet().deleteRow(rowIndex);
      Cache.remove(CACHE_KEY);
      return { id: id };
    });
  }

  return {
    findAll: findAll,
    findById: findById,
    findByCode: findByCode,
    insert: insert,
    insertMany: insertMany,
    update: update,
    remove: remove,
  };

})();
