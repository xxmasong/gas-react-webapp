var InventoryItemService = (function () {

  // qtyTotal = ground pieces + upstair pieces + (boxes × units-per-box).
  var computeQtyTotal = (item) => {
    var box = Number(item.qtyBox) || 0;
    var uom = Number(item.uom) || 0;
    return (Number(item.qtyGround) || 0)
      + (Number(item.qtyUpstair) || 0)
      + (box * uom);
  };

  // Prefer the new cost; fall back to old; default 0.
  var unitCost = (item) => {
    var n = Number(item.costPerPieceNew) || 0;
    if (n > 0) return n;
    return Number(item.costPerPieceOld) || 0;
  };

  // Recompute the derived fields and return a fully-populated item.
  var withComputed = (item) => {
    var qtyTotal  = computeQtyTotal(item);
    var qtyKyte   = Number(item.qtyKyte) || 0;
    // Match when there is no Kyte figure, or it equals the on-hand total.
    var kyteMatch = qtyKyte === 0 ? true : qtyTotal === qtyKyte;
    item.qtyTotal  = qtyTotal;
    item.qtyKyte   = qtyKyte;
    item.kyteMatch = kyteMatch;
    item.costTotal = unitCost(item) * qtyTotal;
    return item;
  };

  var num = (v) => Number(v) || 0;
  var str = (v) => String(v == null ? '' : v).trim();
  var store = (v) => {
    var s = str(v).toUpperCase();
    return Config.STORES.indexOf(s) !== -1 ? s : Config.DEFAULT_STORE;
  };

  // Prices/costs are read-only reference data. On add they come from the
  // migration payload; on update we ignore the client and carry `prices`
  // forward from the stored item.
  var normalize = (input, id, updatedAt, prices) => {
    var src = prices || input;
    return withComputed({
      id:                    id,
      categoryId:            String(input.categoryId),
      store:                 store(input.store),
      sku:                   str(input.sku),
      emoji:                 str(input.emoji),
      uom:                   num(input.uom),
      costPerBoxNew:         num(src.costPerBoxNew),
      costPerPieceNew:       num(src.costPerPieceNew),
      costPerPieceOld:       num(src.costPerPieceOld),
      sellingPriceWholesale: num(src.sellingPriceWholesale),
      sellingPriceDealer:    num(src.sellingPriceDealer),
      sellingPricePiece:     num(src.sellingPricePiece),
      srp:                   num(src.srp),
      qtyGround:             num(input.qtyGround),
      expiryGround:          str(input.expiryGround),
      qtyUpstair:            num(input.qtyUpstair),
      expiryUpstair:         str(input.expiryUpstair),
      qtyBox:                num(input.qtyBox),
      expiryBox:             str(input.expiryBox),
      qtyKyte:               num(input.qtyKyte),
      updatedAt:             updatedAt,
    });
  };

  var getInventoryItems = (categoryId) =>
    InventoryItemRepository.findAll(categoryId);

  // Single item by id (used for audit before-snapshots). Returns null if absent.
  var getInventoryItem = (id) =>
    InventoryItemRepository.findById(id);

  var addInventoryItem = (input) => {
    if (!CategoryRepository.findById(input.categoryId)) {
      throw Kernel.AppError.validation('categoryId does not reference a known category');
    }
    var item = normalize(input, Kernel.Uuid.generate(), Kernel.DateTime.nowIso());
    return InventoryItemRepository.insert(item);
  };

  var updateInventoryItem = (input) => {
    var existing = InventoryItemRepository.findById(input.id);
    if (!existing) throw Kernel.AppError.notFound('InventoryItem', input.id);
    if (!CategoryRepository.findById(input.categoryId)) {
      throw Kernel.AppError.validation('categoryId does not reference a known category');
    }
    // Preserve read-only prices/costs from the stored item.
    var item = normalize(input, existing.id, Kernel.DateTime.nowIso(), existing);
    return InventoryItemRepository.update(item);
  };

  var deleteInventoryItem = (id) => {
    var existing = InventoryItemRepository.findById(id);
    if (!existing) throw Kernel.AppError.notFound('InventoryItem', id);
    return InventoryItemRepository.remove(id);
  };

  // Apply many stock-level changes at once. Each update carries the three
  // location quantities; everything else is preserved from the stored item.
  var bulkUpdateStock = (updates) => {
    var now     = Kernel.DateTime.nowIso();
    var changed = updates.map((u) => {
      var existing = InventoryItemRepository.findById(u.id);
      if (!existing) throw Kernel.AppError.notFound('InventoryItem', u.id);
      existing.qtyGround  = num(u.qtyGround);
      existing.qtyUpstair = num(u.qtyUpstair);
      existing.qtyBox     = num(u.qtyBox);
      existing.updatedAt  = now;
      return withComputed(existing);
    });
    return InventoryItemRepository.updateMany(changed);
  };

  // Save one stock row and read it back DIRECTLY from the sheet (cache
  // bypassed) so the client can verify the persisted value matches what it
  // sent. Returns the freshly-read item.
  var saveAndVerifyStock = (update) => {
    var existing = InventoryItemRepository.findById(update.id);
    if (!existing) throw Kernel.AppError.notFound('InventoryItem', update.id);
    existing.qtyGround  = num(update.qtyGround);
    existing.qtyUpstair = num(update.qtyUpstair);
    existing.qtyBox     = num(update.qtyBox);
    existing.updatedAt  = Kernel.DateTime.nowIso();
    InventoryItemRepository.update(withComputed(existing));
    // Re-read straight from the sheet (not the just-written object) so we
    // confirm the row on disk reflects the change.
    var fresh = InventoryItemRepository.findByIdFresh(update.id);
    if (!fresh) throw Kernel.AppError.notFound('InventoryItem', update.id);
    return fresh;
  };

  return {
    getInventoryItems: getInventoryItems,
    getInventoryItem: getInventoryItem,
    addInventoryItem: addInventoryItem,
    updateInventoryItem: updateInventoryItem,
    deleteInventoryItem: deleteInventoryItem,
    bulkUpdateStock: bulkUpdateStock,
    saveAndVerifyStock: saveAndVerifyStock,
  };

})();
