// Depends on AppError (errors.js). Both are always loaded together.

var validate = (function () {

  function required(value, name) {
    if (value === undefined || value === null)
      throw AppError.validation(name + ' is required');
  }

  function string(value, name) {
    required(value, name);
    if (typeof value !== 'string' || value.trim() === '')
      throw AppError.validation(name + ' must be a non-empty string');
  }

  function nonNegativeNumber(value, name) {
    var n = Number(value);
    if (isNaN(n) || n < 0)
      throw AppError.validation(name + ' must be a non-negative number');
  }

  function uuid(value, name) {
    var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(String(value)))
      throw AppError.validation(name + ' must be a valid UUID');
  }

  function positiveNumber(value, name) {
    var n = Number(value);
    if (isNaN(n) || n <= 0)
      throw AppError.validation(name + ' must be a positive number');
  }

  function array(value, name) {
    if (!Array.isArray(value))
      throw AppError.validation(name + ' must be an array');
  }

  function category(cat) {
    required(cat, 'category');
    string(cat.code, 'code');
    if (cat.code.length > 10)
      throw AppError.validation('code must be 10 characters or fewer');
    string(cat.name, 'name');
    nonNegativeNumber(cat.sortOrder, 'sortOrder');
  }

  function store(value, name) {
    var s = String(value == null ? '' : value).toUpperCase();
    if (s !== 'EASY' && s !== 'GRUTON')
      throw AppError.validation(name + " must be 'EASY' or 'GRUTON'");
  }

  function inventoryItem(item) {
    required(item, 'item');
    string(item.categoryId, 'categoryId');
    store(item.store, 'store');
    string(item.sku, 'sku');
    positiveNumber(item.uom, 'uom');
    nonNegativeNumber(item.qtyGround, 'qtyGround');
    nonNegativeNumber(item.qtyUpstair, 'qtyUpstair');
    nonNegativeNumber(item.qtyBox, 'qtyBox');
  }

  function stockUpdate(u) {
    required(u, 'update');
    string(u.id, 'id');
    nonNegativeNumber(u.qtyGround, 'qtyGround');
    nonNegativeNumber(u.qtyUpstair, 'qtyUpstair');
    nonNegativeNumber(u.qtyBox, 'qtyBox');
  }

  return {
    required: required,
    string: string,
    nonNegativeNumber: nonNegativeNumber,
    positiveNumber: positiveNumber,
    array: array,
    uuid: uuid,
    store: store,
    category: category,
    inventoryItem: inventoryItem,
    stockUpdate: stockUpdate,
  };

})();
