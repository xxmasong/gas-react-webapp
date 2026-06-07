var CategoryRepository = (function () {

  var SHEET_NAME = Config.SHEETS.categories;
  var HEADERS    = ['id', 'code', 'name', 'packConstraint', 'sortOrder', 'updatedAt'];
  var CACHE_KEY  = Config.CACHE_KEYS.categories;

  var getSheet = () => {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.setFrozenRows(1);
    }
    return sheet;
  };

  var findAll = () =>
    Kernel.Cache.getOrSet(CACHE_KEY, () => {
      var sheet   = getSheet();
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];
      return sheet
        .getRange(2, 1, lastRow - 1, HEADERS.length)
        .getValues()
        .filter((row) => row[0] !== '' && row[0] != null)
        .map(CategoryMapper.fromRow)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }, Config.CACHE_TTL.categories);

  var findById = (id) =>
    findAll().find((c) => c.id === String(id)) || null;

  var findByCode = (code) =>
    findAll().find((c) => c.code === String(code)) || null;

  var findRowIndexById = (id) => {
    var sheet   = getSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return -1;
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(id)) return i + 2;
    }
    return -1;
  };

  var insert = (cat) =>
    Kernel.Lock.withLock(() => {
      getSheet().appendRow(CategoryMapper.toRow(cat));
      Kernel.Cache.remove(CACHE_KEY);
      return cat;
    });

  // Write all cats in a single setValues call. Assumes the sheet is empty
  // (header row already present). Does NOT acquire the lock — caller must
  // ensure exclusive access (used only from reseedInventory).
  var insertMany = (cats) => {
    if (!cats.length) return cats;
    var sheet = getSheet();
    var rows  = cats.map(CategoryMapper.toRow);
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    Kernel.Cache.remove(CACHE_KEY);
    return cats;
  };

  var update = (cat) =>
    Kernel.Lock.withLock(() => {
      var rowIndex = findRowIndexById(cat.id);
      if (rowIndex === -1) throw Kernel.AppError.notFound('Category', cat.id);
      getSheet()
        .getRange(rowIndex, 1, 1, HEADERS.length)
        .setValues([CategoryMapper.toRow(cat)]);
      Kernel.Cache.remove(CACHE_KEY);
      return cat;
    });

  var remove = (id) =>
    Kernel.Lock.withLock(() => {
      var rowIndex = findRowIndexById(id);
      if (rowIndex === -1) throw Kernel.AppError.notFound('Category', id);
      getSheet().deleteRow(rowIndex);
      Kernel.Cache.remove(CACHE_KEY);
      return { id: id };
    });

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
