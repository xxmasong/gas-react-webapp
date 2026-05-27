// row[]: [id, name, quantity, updatedAt]

var ItemMapper = (function () {

  function fromRow(row) {
    return {
      id:        String(row[0]),
      name:      String(row[1]),
      quantity:  Number(row[2]) || 0,
      updatedAt: String(row[3]),
    };
  }

  function toRow(item) {
    return [item.id, item.name, item.quantity, item.updatedAt];
  }

  return { fromRow: fromRow, toRow: toRow };

})();
