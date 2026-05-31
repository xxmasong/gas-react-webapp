var CategoryService = (function () {

  var getCategories = () => CategoryRepository.findAll();

  var addCategory = (input) => {
    var code = String(input.code).trim();
    if (CategoryRepository.findByCode(code)) {
      throw AppError.conflict('Category code already exists: ' + code);
    }
    var cat = {
      id:             Uuid.generate(),
      code:           code,
      name:           String(input.name).trim(),
      packConstraint: String(input.packConstraint == null ? '' : input.packConstraint).trim(),
      sortOrder:      Number(input.sortOrder) || 0,
      updatedAt:      DateTime.nowIso(),
    };
    return CategoryRepository.insert(cat);
  };

  var updateCategory = (input) => {
    var existing = CategoryRepository.findById(input.id);
    if (!existing) throw AppError.notFound('Category', input.id);

    var code = String(input.code).trim();
    var clash = CategoryRepository.findByCode(code);
    if (clash && clash.id !== existing.id) {
      throw AppError.conflict('Category code already exists: ' + code);
    }
    var updated = {
      id:             existing.id,
      code:           code,
      name:           String(input.name).trim(),
      packConstraint: String(input.packConstraint == null ? '' : input.packConstraint).trim(),
      sortOrder:      Number(input.sortOrder) || 0,
      updatedAt:      DateTime.nowIso(),
    };
    return CategoryRepository.update(updated);
  };

  var deleteCategory = (id) => {
    var existing = CategoryRepository.findById(id);
    if (!existing) throw AppError.notFound('Category', id);
    var dependents = InventoryItemRepository.findByCategoryId(id);
    if (dependents.length > 0) {
      throw AppError.conflict('Category has ' + dependents.length + ' item(s); delete items first');
    }
    return CategoryRepository.remove(id);
  };

  return {
    getCategories: getCategories,
    addCategory: addCategory,
    updateCategory: updateCategory,
    deleteCategory: deleteCategory,
  };

})();
