var InventoryService = (function () {

  function getItems() {
    return ItemRepository.findAll();
  }

  function addItem(input) {
    if (input.quantity < 0) throw AppError.validation('quantity cannot be negative');
    var item = {
      id:        Uuid.generate(),
      name:      String(input.name).trim(),
      quantity:  Number(input.quantity),
      updatedAt: DateTime.nowIso(),
    };
    return ItemRepository.insert(item);
  }

  function updateItem(input) {
    var existing = ItemRepository.findById(input.id);
    if (!existing) throw AppError.notFound('Item', input.id);
    if (input.quantity < 0) throw AppError.validation('quantity cannot be negative');
    var updated = {
      id:        existing.id,
      name:      String(input.name).trim(),
      quantity:  Number(input.quantity),
      updatedAt: DateTime.nowIso(),
    };
    return ItemRepository.update(updated);
  }

  function deleteItem(id) {
    var existing = ItemRepository.findById(id);
    if (!existing) throw AppError.notFound('Item', id);
    return ItemRepository.remove(id);
  }

  return { getItems: getItems, addItem: addItem, updateItem: updateItem, deleteItem: deleteItem };

})();
