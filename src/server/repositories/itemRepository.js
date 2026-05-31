var ItemRepository = (function () {

  var SHEET_NAME = Config.SHEETS.items;
  var HEADERS    = ['id', 'name', 'quantity', 'updatedAt'];
  var CACHE_KEY  = Config.CACHE_KEYS.items;

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
    Cache.getOrSet(CACHE_KEY, () => {
      var sheet   = getSheet();
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];
      return sheet
        .getRange(2, 1, lastRow - 1, HEADERS.length)
        .getValues()
        .filter((row) => row[0] !== '' && row[0] != null)
        .map(ItemMapper.fromRow);
    }, Config.CACHE_TTL.items);

  var findById = (id) =>
    findAll().find((item) => item.id === String(id)) || null;

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

  var insert = (item) =>
    Lock.withLock(() => {
      getSheet().appendRow(ItemMapper.toRow(item));
      Cache.remove(CACHE_KEY);
      return item;
    });

  var update = (item) =>
    Lock.withLock(() => {
      var rowIndex = findRowIndexById(item.id);
      if (rowIndex === -1) throw AppError.notFound('Item', item.id);
      getSheet()
        .getRange(rowIndex, 1, 1, HEADERS.length)
        .setValues([ItemMapper.toRow(item)]);
      Cache.remove(CACHE_KEY);
      return item;
    });

  var remove = (id) =>
    Lock.withLock(() => {
      var rowIndex = findRowIndexById(id);
      if (rowIndex === -1) throw AppError.notFound('Item', id);
      getSheet().deleteRow(rowIndex);
      Cache.remove(CACHE_KEY);
      return { id: id };
    });

  return { findAll: findAll, findById: findById, insert: insert, update: update, remove: remove };

})();
