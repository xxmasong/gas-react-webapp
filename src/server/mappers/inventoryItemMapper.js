// row[]: [
//   id, categoryId, sku, emoji, uom,
//   costPerBoxNew, costPerPieceNew, costPerPieceOld,
//   sellingPriceWholesale, sellingPriceDealer, sellingPricePiece, srp,
//   qtyGround, expiryGround, qtyUpstair, expiryUpstair, qtyBox, expiryBox,
//   qtyTotal, qtyKyte, kyteMatch, costTotal, updatedAt
// ]

var InventoryItemMapper = (function () {

  function num(v) { return Number(v) || 0; }

  // Sheet date cells may come back as Date objects, ISO strings, or ''.
  function dateStr(v) {
    if (v == null || v === '') return '';
    if (Object.prototype.toString.call(v) === '[object Date]') {
      return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
    }
    return String(v);
  }

  function fromRow(row) {
    return {
      id:                    String(row[0]),
      categoryId:            String(row[1]),
      sku:                   String(row[2]),
      emoji:                 String(row[3] == null ? '' : row[3]),
      uom:                   num(row[4]),
      costPerBoxNew:         num(row[5]),
      costPerPieceNew:       num(row[6]),
      costPerPieceOld:       num(row[7]),
      sellingPriceWholesale: num(row[8]),
      sellingPriceDealer:    num(row[9]),
      sellingPricePiece:     num(row[10]),
      srp:                   num(row[11]),
      qtyGround:             num(row[12]),
      expiryGround:          dateStr(row[13]),
      qtyUpstair:            num(row[14]),
      expiryUpstair:         dateStr(row[15]),
      qtyBox:                num(row[16]),
      expiryBox:             dateStr(row[17]),
      qtyTotal:              num(row[18]),
      qtyKyte:               num(row[19]),
      kyteMatch:             row[20] === true || String(row[20]).toLowerCase() === 'true',
      costTotal:             num(row[21]),
      updatedAt:             String(row[22]),
    };
  }

  function toRow(item) {
    return [
      item.id, item.categoryId, item.sku, item.emoji, item.uom,
      item.costPerBoxNew, item.costPerPieceNew, item.costPerPieceOld,
      item.sellingPriceWholesale, item.sellingPriceDealer, item.sellingPricePiece, item.srp,
      item.qtyGround, item.expiryGround, item.qtyUpstair, item.expiryUpstair, item.qtyBox, item.expiryBox,
      item.qtyTotal, item.qtyKyte, item.kyteMatch, item.costTotal, item.updatedAt,
    ];
  }

  return { fromRow: fromRow, toRow: toRow };

})();
