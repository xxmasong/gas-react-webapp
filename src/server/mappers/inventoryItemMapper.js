// row[]: [
//   id, categoryId, store, sku, emoji, uom,
//   costPerBoxNew, costPerPieceNew, costPerPieceOld,
//   sellingPriceWholesale, sellingPriceDealer, sellingPricePiece, srp,
//   qtyGround, expiryGround, qtyUpstair, expiryUpstair, qtyBox, expiryBox,
//   qtyTotal, qtyKyte, kyteMatch, costTotal, updatedAt
// ]

var InventoryItemMapper = (function () {

  var num = (v) => Number(v) || 0;

  // Normalize the store cell; anything that isn't GRUTON defaults to EASY.
  var store = (v) =>
    String(v == null ? '' : v).trim().toUpperCase() === 'GRUTON' ? 'GRUTON' : 'EASY';

  // Sheet date cells may come back as Date objects, ISO strings, or ''.
  var dateStr = (v) => {
    if (v == null || v === '') return '';
    if (Object.prototype.toString.call(v) === '[object Date]') {
      return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
    }
    return String(v);
  };

  var fromRow = (row) => ({
    id:                    String(row[0]),
    categoryId:            String(row[1]),
    store:                 store(row[2]),
    sku:                   String(row[3]),
    emoji:                 String(row[4] == null ? '' : row[4]),
    uom:                   num(row[5]),
    costPerBoxNew:         num(row[6]),
    costPerPieceNew:       num(row[7]),
    costPerPieceOld:       num(row[8]),
    sellingPriceWholesale: num(row[9]),
    sellingPriceDealer:    num(row[10]),
    sellingPricePiece:     num(row[11]),
    srp:                   num(row[12]),
    qtyGround:             num(row[13]),
    expiryGround:          dateStr(row[14]),
    qtyUpstair:            num(row[15]),
    expiryUpstair:         dateStr(row[16]),
    qtyBox:                num(row[17]),
    expiryBox:             dateStr(row[18]),
    qtyTotal:              num(row[19]),
    qtyKyte:               num(row[20]),
    kyteMatch:             row[21] === true || String(row[21]).toLowerCase() === 'true',
    costTotal:             num(row[22]),
    updatedAt:             String(row[23]),
  });

  var toRow = (item) => [
    item.id, item.categoryId, item.store, item.sku, item.emoji, item.uom,
    item.costPerBoxNew, item.costPerPieceNew, item.costPerPieceOld,
    item.sellingPriceWholesale, item.sellingPriceDealer, item.sellingPricePiece, item.srp,
    item.qtyGround, item.expiryGround, item.qtyUpstair, item.expiryUpstair, item.qtyBox, item.expiryBox,
    item.qtyTotal, item.qtyKyte, item.kyteMatch, item.costTotal, item.updatedAt,
  ];

  return { fromRow: fromRow, toRow: toRow };

})();
