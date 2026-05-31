// row[]: [id, code, name, packConstraint, sortOrder, updatedAt]

var CategoryMapper = (function () {

  var fromRow = (row) => ({
    id:             String(row[0]),
    code:           String(row[1]),
    name:           String(row[2]),
    packConstraint: String(row[3] == null ? '' : row[3]),
    sortOrder:      Number(row[4]) || 0,
    updatedAt:      String(row[5]),
  });

  var toRow = (cat) =>
    [cat.id, cat.code, cat.name, cat.packConstraint, cat.sortOrder, cat.updatedAt];

  return { fromRow: fromRow, toRow: toRow };

})();
