---
paths:
  - "src/server/**/*.js"
  - "src/server/**/*.ts"
---

# Server layer rules

You are editing the GAS backend. These rules are absolute.

## Layer you are in

`api.js → service → repository → mapper` — identify which layer the file belongs to before writing.

## Kernel (cross-cutting logic lives in the shared library, not here)
- Call as `Kernel.<Name>` — `Kernel.Cache`, `Kernel.Lock`, `Kernel.Uuid`, `Kernel.DateTime`, `Kernel.AppError`, `Kernel.Crypto`, `Kernel.Validate`, `Kernel.Auth`, `Kernel.Sheets`, `Kernel.Gateway`, `Kernel.Audit`, `Kernel.Config`.
- These were formerly `src/server/lib/*` + auth — **do not recreate them in `src/server`**; they moved to the Kernel (`d:\kernel`). The only `lib/` file left is `validate.js` (domain validators on `Kernel.Validate`).
- Editing the Kernel itself is a separate repo/project — not covered by these `src/server/**` rules.

## api.js
- Top-level **named function declarations only** — `function foo(token, input) {}`. Never arrow, never `const foo =`, never `export`.
- **Every function routes through the Gateway:**
  `return Kernel.Gateway.handle(ctx, () => { validate.xxx(...); return SomeService.fn(...); });`
- `ctx = { token, action, role?, public?, audit? }`. `role` ⇒ requireRole; absent ⇒ requireUser; `public:true` ⇒ skip auth (e.g. `me`/`logout`). `login` is the ONLY function that bypasses the gateway.
- Mutations set `ctx.audit = { entity, op, recordId?, before?: () => snapshot, after?: (r)=>… }`. Reads omit `audit`.
- Validation goes **inside** the delegate (runs after auth). Never catch errors — let them propagate (the gateway normalizes + rethrows).

## services/
- All business logic lives here — not in api.js, not in repositories
- Throw `Kernel.AppError.notFound/conflict/validation` — never return null on error
- Computed fields (`qtyTotal`, `kyteMatch`, `costTotal`) must be recalculated on every write
- Cost/price fields preserved from DB on update — never overwrite from client input
- Provide singular `getX(id)` getters where mutations need audit before-snapshots

## repositories/
- One `getRange().getValues()` call per read operation — never cell-by-cell
- Every write inside `Kernel.Lock.withLock(fn)` — no exceptions
- `Kernel.Cache.remove(CACHE_KEY)` immediately after every mutation
- Read pattern: `Kernel.Cache.getOrSet(KEY, () => sheet.getRange(...).getValues().filter().map(Mapper.fromRow), TTL)`

## mappers/
- Pure functions only — `fromRow(row[])` and `toRow(entity)` — zero I/O, zero service calls
- Column order must match `HEADERS` exactly
- `fromRow` must handle null/empty cells: `String(row[N] || '')`, `Number(row[N]) || 0`

## lib/ (validate.js only)
- `lib/validate.js` holds **domain** validators (`category`, `inventoryItem`, `store`, `stockUpdate`) built on `Kernel.Validate` primitives + `Kernel.AppError`
- Throw `Kernel.AppError.validation(msg)` from validators, never return false

## GAS rules (non-negotiable)
- No `import`/`export` anywhere — GAS V8 rejects ES modules
- All variables via IIFE: `var Foo = (function() { ... return { ... }; })();`
- `Kernel.Uuid.generate()` only for IDs — never `Math.random()` or client values
- `Kernel.DateTime.nowIso()` for all timestamps
- `console.log` goes to Stackdriver — use it for debugging

---

## Canonical code templates

These are the single source of truth for backend layer shape. Copy the structure exactly.

### api.js function — read (no audit)
```js
function getInventoryItems(token, categoryId) {   // named function declaration, not arrow
  return Kernel.Gateway.handle(
    { token, action: 'getInventoryItems' },        // no role => requireUser; no audit => read
    () => InventoryItemService.getInventoryItems(categoryId)
  );
}
```

### api.js function — mutation (audited)
```js
function updateInventoryItem(token, item) {
  return Kernel.Gateway.handle(
    { token, action: 'updateInventoryItem', role: _getRole().SUPERVISOR,
      audit: { entity: 'InventoryItem', op: 'update', recordId: item && item.id,
               before: () => InventoryItemService.getInventoryItem(item.id) } },
    () => {                                          // validate INSIDE the delegate (after auth)
      validate.inventoryItem(item);
      validate.string(item.id, 'id');
      return InventoryItemService.updateInventoryItem(item);   // never catch — gateway handles
    }
  );
}
```
`_getRole()` returns `Kernel.Config.ROLES`. `login` is the only function that bypasses the gateway.

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

  var findAll = () => Kernel.Cache.getOrSet(CACHE_KEY, () => {
    var sheet = getSheet(); var last = sheet.getLastRow();
    if (last < 2) return [];
    return sheet.getRange(2, 1, last - 1, HEADERS.length).getValues()
      .filter(r => r[0]).map(CategoryMapper.fromRow).sort((a,b) => a.sortOrder - b.sortOrder);
  }, Config.CACHE_TTL.categories);

  var findById = (id) => findAll().find(c => c.id === String(id)) || null;

  var insert = (cat) => Kernel.Lock.withLock(() => {
    getSheet().appendRow(CategoryMapper.toRow(cat));
    Kernel.Cache.remove(CACHE_KEY);
    return cat;
  });

  var update = (cat) => Kernel.Lock.withLock(() => {
    var sheet = getSheet();
    var rows  = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
    var idx   = rows.findIndex(r => r[0] === cat.id);
    if (idx === -1) throw Kernel.AppError.notFound('Category', cat.id);
    sheet.getRange(idx + 2, 1, 1, HEADERS.length).setValues([CategoryMapper.toRow(cat)]);
    Kernel.Cache.remove(CACHE_KEY);
    return cat;
  });

  var remove = (id) => Kernel.Lock.withLock(() => {
    var sheet = getSheet();
    var rows  = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var idx   = rows.findIndex(r => r[0] === id);
    if (idx === -1) throw Kernel.AppError.notFound('Category', id);
    sheet.deleteRow(idx + 2);
    Kernel.Cache.remove(CACHE_KEY);
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
    if (CategoryRepository.findByCode(code)) throw Kernel.AppError.conflict('Category code exists: ' + code);
    var cat = { id: Kernel.Uuid.generate(), code, name: String(input.name).trim(),
                packConstraint: String(input.packConstraint || '').trim(),
                sortOrder: Number(input.sortOrder) || 0, updatedAt: Kernel.DateTime.nowIso() };
    return CategoryRepository.insert(cat);
  };
  var updateCategory = (input) => {
    var existing = CategoryRepository.findById(input.id);
    if (!existing) throw Kernel.AppError.notFound('Category', input.id);
    var clash = CategoryRepository.findByCode(String(input.code).trim());
    if (clash && clash.id !== existing.id) throw Kernel.AppError.conflict('Category code exists: ' + input.code);
    return CategoryRepository.update({ ...existing, ...input, updatedAt: Kernel.DateTime.nowIso() });
  };
  // Singular getter so api.js can take an audit before-snapshot.
  var getCategory = (id) => CategoryRepository.findById(id);
  return { getCategories: () => CategoryRepository.findAll(), getCategory, addCategory, updateCategory, deleteCategory };
})();
```

### Validator (domain validator in `lib/validate.js`, built on Kernel primitives)
```js
var category = (input) => {
  Kernel.Validate.required(input, 'category');
  Kernel.Validate.string(input.code, 'code');
  Kernel.Validate.string(input.name, 'name');
};
```
