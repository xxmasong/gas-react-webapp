var SummaryService = (function () {

  function getInventorySummary() {
    var items      = InventoryItemRepository.findAll();
    var categories = CategoryRepository.findAll();
    var totalCost     = 0;
    var totalQty      = 0;
    var mismatchCount = 0;
    var zeroStockCount = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      totalCost += Number(it.costTotal) || 0;
      totalQty  += Number(it.qtyTotal) || 0;
      if (!it.kyteMatch) mismatchCount++;
      if ((Number(it.qtyTotal) || 0) === 0) zeroStockCount++;
    }
    return {
      totalCost:      totalCost,
      totalQty:       totalQty,
      categoryCount:  categories.length,
      skuCount:       items.length,
      mismatchCount:  mismatchCount,
      zeroStockCount: zeroStockCount,
    };
  }

  function getCategoryTotals() {
    var categories = CategoryRepository.findAll();
    var items      = InventoryItemRepository.findAll();

    var byCat = {};
    for (var i = 0; i < items.length; i++) {
      var it  = items[i];
      var key = it.categoryId;
      if (!byCat[key]) byCat[key] = { cost: 0, qty: 0, count: 0 };
      byCat[key].cost  += Number(it.costTotal) || 0;
      byCat[key].qty   += Number(it.qtyTotal) || 0;
      byCat[key].count += 1;
    }

    return categories.map(function (cat) {
      var agg = byCat[cat.id] || { cost: 0, qty: 0, count: 0 };
      return {
        categoryId:   cat.id,
        categoryCode: cat.code,
        categoryName: cat.name,
        totalCost:    agg.cost,
        totalQty:     agg.qty,
        skuCount:     agg.count,
      };
    });
  }

  return {
    getInventorySummary: getInventorySummary,
    getCategoryTotals: getCategoryTotals,
  };

})();
