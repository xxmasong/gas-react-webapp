// Inventory domain validators. Primitives (required/string/number/array/uuid)
// now live in the Kernel as Kernel.Validate; this file builds the
// Inventory-specific validators on top of them. Exposed as `validate`.
//
// Depends on Kernel.Validate, Kernel.AppError, and the module's own Config.

var validate = (function () {

  var category = (cat) => {
    Kernel.Validate.required(cat, 'category');
    Kernel.Validate.string(cat.code, 'code');
    if (cat.code.length > 10)
      throw Kernel.AppError.validation('code must be 10 characters or fewer');
    Kernel.Validate.string(cat.name, 'name');
    Kernel.Validate.nonNegativeNumber(cat.sortOrder, 'sortOrder');
  };

  var store = (value, name) => {
    var s = String(value == null ? '' : value).toUpperCase();
    if (Config.STORES.indexOf(s) === -1)
      throw Kernel.AppError.validation(name + ' must be one of: ' + Config.STORES.join(', '));
  };

  var inventoryItem = (item) => {
    Kernel.Validate.required(item, 'item');
    Kernel.Validate.string(item.categoryId, 'categoryId');
    store(item.store, 'store');
    Kernel.Validate.string(item.sku, 'sku');
    Kernel.Validate.positiveNumber(item.uom, 'uom');
    Kernel.Validate.nonNegativeNumber(item.qtyGround, 'qtyGround');
    Kernel.Validate.nonNegativeNumber(item.qtyUpstair, 'qtyUpstair');
    Kernel.Validate.nonNegativeNumber(item.qtyBox, 'qtyBox');
  };

  var stockUpdate = (u) => {
    Kernel.Validate.required(u, 'update');
    Kernel.Validate.string(u.id, 'id');
    Kernel.Validate.nonNegativeNumber(u.qtyGround, 'qtyGround');
    Kernel.Validate.nonNegativeNumber(u.qtyUpstair, 'qtyUpstair');
    Kernel.Validate.nonNegativeNumber(u.qtyBox, 'qtyBox');
  };

  // Re-export the Kernel primitives that api.js calls directly (e.g. validate.array,
  // validate.string) so existing api.js call sites keep working unchanged.
  return {
    required:          (v, n) => Kernel.Validate.required(v, n),
    string:            (v, n) => Kernel.Validate.string(v, n),
    nonNegativeNumber: (v, n) => Kernel.Validate.nonNegativeNumber(v, n),
    positiveNumber:    (v, n) => Kernel.Validate.positiveNumber(v, n),
    uuid:              (v, n) => Kernel.Validate.uuid(v, n),
    array:             (v, n) => Kernel.Validate.array(v, n),
    category: category,
    store: store,
    inventoryItem: inventoryItem,
    stockUpdate: stockUpdate,
  };

})();
