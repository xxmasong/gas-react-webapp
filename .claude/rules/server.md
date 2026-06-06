---
paths:
  - "src/server/**/*.js"
  - "src/server/**/*.ts"
---

# Server layer rules

You are editing the GAS backend. These rules are absolute.

## Layer you are in

`api.js → service → repository → mapper` — identify which layer the file belongs to before writing.

## api.js
- Top-level **named function declarations only** — `function foo(token, input) {}`
- Never arrow functions, never `const foo =`, never `export`
- Order always: `AuthService.requireRole/requireUser → validate.xxx → delegate → return`
- Never catch errors — let them propagate

## services/
- All business logic lives here — not in api.js, not in repositories
- Throw `AppError.notFound`, `AppError.conflict`, `AppError.validation` — never return null on error
- Computed fields (`qtyTotal`, `kyteMatch`, `costTotal`) must be recalculated on every write
- Cost/price fields preserved from DB on update — never overwrite from client input

## repositories/
- One `getRange().getValues()` call per read operation — never cell-by-cell
- Every write inside `Lock.withLock(fn)` — no exceptions
- `Cache.remove(CACHE_KEY)` immediately after every mutation
- Read pattern: `Cache.getOrSet(KEY, () => sheet.getRange(...).getValues().filter().map(Mapper.fromRow), TTL)`

## mappers/
- Pure functions only — `fromRow(row[])` and `toRow(entity)` — zero I/O, zero service calls
- Column order must match `HEADERS` exactly
- `fromRow` must handle null/empty cells: `String(row[N] || '')`, `Number(row[N]) || 0`

## lib/
- Stateless helpers only — no dependencies on other layers
- Add new validators to `validate.js` and expose on the return object
- Throw `AppError.validation(msg)` from validators, never return false

## GAS rules (non-negotiable)
- No `import`/`export` anywhere — GAS V8 rejects ES modules
- All variables via IIFE: `var Foo = (function() { ... return { ... }; })();`
- `Uuid.generate()` only for IDs — never `Math.random()` or client values
- `DateTime.nowIso()` for all timestamps
- `console.log` goes to Stackdriver — use it for debugging

---

## Canonical code templates

These are the single source of truth for backend layer shape. Copy the structure exactly.

### api.js function
```js
function addInventoryItem(token, item) {        // named function declaration, not arrow
  AuthService.requireRole(token, _getRole().SUPERVISOR);
  validate.inventoryItem(item);
  return InventoryItemService.addInventoryItem(item);  // delegate, never catch
}
```

### Repository
```js
var CategoryRepository = (function () {
  var SHEET_NAME = Config.SHEETS.categories;
  var HEADERS    = ['id', 'code', 'name', 'packConstraint', 'sortOrder', 'updatedAt'];
  var CACHE_KEY  = Config.CACHE_KEYS.categories;

  var getSheet = () => {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) { sheet = ss.insertSheet(SHEET_NAME); sheet.getRange(1,1,1,HEADERS.length).setValues([HEADERS]); sheet.setFrozenRows(1); }
    return sheet;
  };

  var findAll = () => Cache.getOrSet(CACHE_KEY, () => {
    var sheet = getSheet(); var last = sheet.getLastRow();
    if (last < 2) return [];
    return sheet.getRange(2, 1, last - 1, HEADERS.length).getValues()
      .filter(r => r[0]).map(CategoryMapper.fromRow).sort((a,b) => a.sortOrder - b.sortOrder);
  }, Config.CACHE_TTL.categories);

  var findById = (id) => findAll().find(c => c.id === String(id)) || null;

  var insert = (cat) => Lock.withLock(() => {
    getSheet().appendRow(CategoryMapper.toRow(cat));
    Cache.remove(CACHE_KEY);
    return cat;
  });

  var update = (cat) => Lock.withLock(() => {
    var sheet = getSheet();
    var rows  = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
    var idx   = rows.findIndex(r => r[0] === cat.id);
    if (idx === -1) throw AppError.notFound('Category', cat.id);
    sheet.getRange(idx + 2, 1, 1, HEADERS.length).setValues([CategoryMapper.toRow(cat)]);
    Cache.remove(CACHE_KEY);
    return cat;
  });

  var remove = (id) => Lock.withLock(() => {
    var sheet = getSheet();
    var rows  = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var idx   = rows.findIndex(r => r[0] === id);
    if (idx === -1) throw AppError.notFound('Category', id);
    sheet.deleteRow(idx + 2);
    Cache.remove(CACHE_KEY);
  });

  return { findAll, findById, insert, update, remove };
})();
```

### Mapper
```js
var CategoryMapper = (function () {
  var fromRow = (row) => ({
    id: String(row[0]), code: String(row[1]), name: String(row[2]),
    packConstraint: String(row[3] || ''), sortOrder: Number(row[4]) || 0, updatedAt: String(row[5]),
  });
  var toRow = (cat) => [cat.id, cat.code, cat.name, cat.packConstraint, cat.sortOrder, cat.updatedAt];
  return { fromRow, toRow };
})();
```

### Service
```js
var CategoryService = (function () {
  var addCategory = (input) => {
    var code = String(input.code).trim();
    if (CategoryRepository.findByCode(code)) throw AppError.conflict('Category code exists: ' + code);
    var cat = { id: Uuid.generate(), code, name: String(input.name).trim(),
                packConstraint: String(input.packConstraint || '').trim(),
                sortOrder: Number(input.sortOrder) || 0, updatedAt: DateTime.nowIso() };
    return CategoryRepository.insert(cat);
  };
  var updateCategory = (input) => {
    var existing = CategoryRepository.findById(input.id);
    if (!existing) throw AppError.notFound('Category', input.id);
    var clash = CategoryRepository.findByCode(String(input.code).trim());
    if (clash && clash.id !== existing.id) throw AppError.conflict('Category code exists: ' + input.code);
    return CategoryRepository.update({ ...existing, ...input, updatedAt: DateTime.nowIso() });
  };
  return { getCategories: () => CategoryRepository.findAll(), addCategory, updateCategory, deleteCategory };
})();
```

### Validator (add to `validate.js` return object)
```js
var category = (input) => {
  required(input, 'category');
  string(input.code, 'code');
  string(input.name, 'name');
};
```
