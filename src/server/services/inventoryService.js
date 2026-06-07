var InventoryService = (function () {

  var getItems = () => ItemRepository.findAll();

  var addItem = (input) => {
    if (input.quantity < 0) throw Kernel.AppError.validation('quantity cannot be negative');
    var item = {
      id:        Kernel.Uuid.generate(),
      name:      String(input.name).trim(),
      quantity:  Number(input.quantity),
      updatedAt: Kernel.DateTime.nowIso(),
    };
    return ItemRepository.insert(item);
  };

  var updateItem = (input) => {
    var existing = ItemRepository.findById(input.id);
    if (!existing) throw Kernel.AppError.notFound('Item', input.id);
    if (input.quantity < 0) throw Kernel.AppError.validation('quantity cannot be negative');
    var updated = {
      id:        existing.id,
      name:      String(input.name).trim(),
      quantity:  Number(input.quantity),
      updatedAt: Kernel.DateTime.nowIso(),
    };
    return ItemRepository.update(updated);
  };

  var deleteItem = (id) => {
    var existing = ItemRepository.findById(id);
    if (!existing) throw Kernel.AppError.notFound('Item', id);
    return ItemRepository.remove(id);
  };

  return { getItems: getItems, addItem: addItem, updateItem: updateItem, deleteItem: deleteItem };

})();
