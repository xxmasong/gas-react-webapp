var InventoryItemRepository = (function () {

  var SHEET_NAME = Config.SHEETS.inventoryItems;
  var HEADERS    = [
    'id', 'categoryId', 'store', 'sku', 'emoji', 'uom',
    'costPerBoxNew', 'costPerPieceNew', 'costPerPieceOld',
    'sellingPriceWholesale', 'sellingPriceDealer', 'sellingPricePiece', 'srp',
    'qtyGround', 'expiryGround', 'qtyUpstair', 'expiryUpstair', 'qtyBox', 'expiryBox',
    'qtyTotal', 'qtyKyte', 'kyteMatch', 'costTotal', 'updatedAt',
  ];
  var CACHE_KEY  = Config.CACHE_KEYS.inventoryItems;

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

  var findAll = (categoryId) => {
    var all = Kernel.Cache.getOrSet(CACHE_KEY, () => {
      var sheet   = getSheet();
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];
      return sheet
        .getRange(2, 1, lastRow - 1, HEADERS.length)
        .getValues()
        .filter((row) => row[0] !== '' && row[0] != null)
        .map(InventoryItemMapper.fromRow);
    }, Config.CACHE_TTL.inventoryItems);
    if (categoryId) {
      return all.filter((i) => i.categoryId === String(categoryId));
    }
    return all;
  };

  var findById = (id) =>
    findAll().find((i) => i.id === String(id)) || null;

  // Read a single row straight from the sheet, bypassing the cache. Used by
  // saveAndVerifyStock so the returned value reflects what is actually on disk.
  var findByIdFresh = (id) => {
    var sheet   = getSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;
    var rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === String(id)) return InventoryItemMapper.fromRow(rows[i]);
    }
    return null;
  };

  var findByCategoryId = (categoryId) =>
    findAll().filter((i) => i.categoryId === String(categoryId));

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
    Kernel.Lock.withLock(() => {
      getSheet().appendRow(InventoryItemMapper.toRow(item));
      Kernel.Cache.remove(CACHE_KEY);
      return item;
    });

  // Write all items in a single setValues call. Assumes the sheet is empty
  // (header row already present). Does NOT acquire the lock — caller must
  // ensure exclusive access (used only from reseedInventory).
  var insertMany = (items) => {
    if (!items.length) return items;
    var sheet = getSheet();
    var rows  = items.map(InventoryItemMapper.toRow);
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    Kernel.Cache.remove(CACHE_KEY);
    return items;
  };

  var update = (item) =>
    Kernel.Lock.withLock(() => {
      var rowIndex = findRowIndexById(item.id);
      if (rowIndex === -1) throw Kernel.AppError.notFound('InventoryItem', item.id);
      getSheet()
        .getRange(rowIndex, 1, 1, HEADERS.length)
        .setValues([InventoryItemMapper.toRow(item)]);
      Kernel.Cache.remove(CACHE_KEY);
      return item;
    });

  // Batch-write many items in a single locked pass. Reads the id column once,
  // then writes each changed row. Kernel.Cache.is cleared once at the end.
  var updateMany = (items) =>
    Kernel.Lock.withLock(() => {
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
        if (rowIndex == null) throw Kernel.AppError.notFound('InventoryItem', item.id);
        sheet
          .getRange(rowIndex, 1, 1, HEADERS.length)
          .setValues([InventoryItemMapper.toRow(item)]);
        written.push(item);
      }
      Kernel.Cache.remove(CACHE_KEY);
      return written;
    });

  var remove = (id) =>
    Kernel.Lock.withLock(() => {
      var rowIndex = findRowIndexById(id);
      if (rowIndex === -1) throw Kernel.AppError.notFound('InventoryItem', id);
      getSheet().deleteRow(rowIndex);
      Kernel.Cache.remove(CACHE_KEY);
      return { id: id };
    });

  return {
    findAll: findAll,
    findById: findById,
    findByIdFresh: findByIdFresh,
    findByCategoryId: findByCategoryId,
    insert: insert,
    insertMany: insertMany,
    update: update,
    updateMany: updateMany,
    remove: remove,
  };

})();
