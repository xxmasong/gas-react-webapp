var CategoryService = (function () {

  var getCategories = () => CategoryRepository.findAll();

  // Single category by id (used for audit before-snapshots). Null if absent.
  var getCategory = (id) => CategoryRepository.findById(id);

  var addCategory = (input) => {
    var code = String(input.code).trim();
    if (CategoryRepository.findByCode(code)) {
      throw Kernel.AppError.conflict('Category code already exists: ' + code);
    }
    var cat = {
      id:             Kernel.Uuid.generate(),
      code:           code,
      name:           String(input.name).trim(),
      packConstraint: String(input.packConstraint == null ? '' : input.packConstraint).trim(),
      sortOrder:      Number(input.sortOrder) || 0,
      updatedAt:      Kernel.DateTime.nowIso(),
    };
    return CategoryRepository.insert(cat);
  };

  var updateCategory = (input) => {
    var existing = CategoryRepository.findById(input.id);
    if (!existing) throw Kernel.AppError.notFound('Category', input.id);

    var code = String(input.code).trim();
    var clash = CategoryRepository.findByCode(code);
    if (clash && clash.id !== existing.id) {
      throw Kernel.AppError.conflict('Category code already exists: ' + code);
    }
    var updated = {
      id:             existing.id,
      code:           code,
      name:           String(input.name).trim(),
      packConstraint: String(input.packConstraint == null ? '' : input.packConstraint).trim(),
      sortOrder:      Number(input.sortOrder) || 0,
      updatedAt:      Kernel.DateTime.nowIso(),
    };
    return CategoryRepository.update(updated);
  };

  var deleteCategory = (id) => {
    var existing = CategoryRepository.findById(id);
    if (!existing) throw Kernel.AppError.notFound('Category', id);
    var dependents = InventoryItemRepository.findByCategoryId(id);
    if (dependents.length > 0) {
      throw Kernel.AppError.conflict('Category has ' + dependents.length + ' item(s); delete items first');
    }
    return CategoryRepository.remove(id);
  };

  return {
    getCategories: getCategories,
    getCategory: getCategory,
    addCategory: addCategory,
    updateCategory: updateCategory,
    deleteCategory: deleteCategory,
  };

})();
