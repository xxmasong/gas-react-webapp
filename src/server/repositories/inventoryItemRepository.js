var InventoryItemRepository = (function () {

  var SHEET_NAME = 'InventoryItems';
  var HEADERS    = [
    'id', 'categoryId', 'sku', 'emoji', 'uom',
    'costPerBoxNew', 'costPerPieceNew', 'costPerPieceOld',
    'sellingPriceWholesale', 'sellingPriceDealer', 'sellingPricePiece', 'srp',
    'qtyGround', 'expiryGround', 'qtyUpstair', 'expiryUpstair', 'qtyBox', 'expiryBox',
    'qtyTotal', 'qtyKyte', 'kyteMatch', 'costTotal', 'updatedAt',
  ];
  var CACHE_KEY  = 'inventory_items_all';

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

  function findAll(categoryId) {
    var all = Cache.getOrSet(CACHE_KEY, function () {
      var sheet   = getSheet();
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];
      return sheet
        .getRange(2, 1, lastRow - 1, HEADERS.length)
        .getValues()
        .filter(function (row) { return row[0] !== '' && row[0] != null; })
        .map(InventoryItemMapper.fromRow);
    }, 120);
    if (categoryId) {
      return all.filter(function (i) { return i.categoryId === String(categoryId); });
    }
    return all;
  }

  function findById(id) {
    return findAll().find(function (i) { return i.id === String(id); }) || null;
  }

  function findByCategoryId(categoryId) {
    return findAll().filter(function (i) { return i.categoryId === String(categoryId); });
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
      getSheet().appendRow(InventoryItemMapper.toRow(item));
      Cache.remove(CACHE_KEY);
      return item;
    });
  }

  function update(item) {
    return Lock.withLock(function () {
      var rowIndex = findRowIndexById(item.id);
      if (rowIndex === -1) throw AppError.notFound('InventoryItem', item.id);
      getSheet()
        .getRange(rowIndex, 1, 1, HEADERS.length)
        .setValues([InventoryItemMapper.toRow(item)]);
      Cache.remove(CACHE_KEY);
      return item;
    });
  }

  // Batch-write many items in a single locked pass. Reads the id column once,
  // then writes each changed row. Cache is cleared once at the end.
  function updateMany(items) {
    return Lock.withLock(function () {
      var sheet   = getSheet();
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];
      var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      var rowByid = {};
      for (var i = 0; i < ids.length; i++) {
        rowByid[String(ids[i][0])] = i + 2;
      }
      var written = [];
      for (var j = 0; j < items.length; j++) {
        var item     = items[j];
        var rowIndex = rowByid[String(item.id)];
        if (rowIndex == null) throw AppError.notFound('InventoryItem', item.id);
        sheet
          .getRange(rowIndex, 1, 1, HEADERS.length)
          .setValues([InventoryItemMapper.toRow(item)]);
        written.push(item);
      }
      Cache.remove(CACHE_KEY);
      return written;
    });
  }

  function remove(id) {
    return Lock.withLock(function () {
      var rowIndex = findRowIndexById(id);
      if (rowIndex === -1) throw AppError.notFound('InventoryItem', id);
      getSheet().deleteRow(rowIndex);
      Cache.remove(CACHE_KEY);
      return { id: id };
    });
  }

  return {
    findAll: findAll,
    findById: findById,
    findByCategoryId: findByCategoryId,
    insert: insert,
    update: update,
    updateMany: updateMany,
    remove: remove,
  };

})();
