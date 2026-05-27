var ItemRepository = (function () {

  var SHEET_NAME = 'Items';
  var HEADERS    = ['id', 'name', 'quantity', 'updatedAt'];
  var CACHE_KEY  = 'items_all';

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
        .map(ItemMapper.fromRow);
    }, 300);
  }

  function findById(id) {
    return findAll().find(function (item) { return item.id === String(id); }) || null;
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

  function insert(item) {
    return Lock.withLock(function () {
      getSheet().appendRow(ItemMapper.toRow(item));
      Cache.remove(CACHE_KEY);
      return item;
    });
  }

  function update(item) {
    return Lock.withLock(function () {
      var rowIndex = findRowIndexById(item.id);
      if (rowIndex === -1) throw AppError.notFound('Item', item.id);
      getSheet()
        .getRange(rowIndex, 1, 1, HEADERS.length)
        .setValues([ItemMapper.toRow(item)]);
      Cache.remove(CACHE_KEY);
      return item;
    });
  }

  function remove(id) {
    return Lock.withLock(function () {
      var rowIndex = findRowIndexById(id);
      if (rowIndex === -1) throw AppError.notFound('Item', id);
      getSheet().deleteRow(rowIndex);
      Cache.remove(CACHE_KEY);
      return { id: id };
    });
  }

  return { findAll: findAll, findById: findById, insert: insert, update: update, remove: remove };

})();
