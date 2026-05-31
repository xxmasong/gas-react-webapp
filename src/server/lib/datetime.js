var DateTime = (function () {

  var nowIso = () => new Date().toISOString();

  var isValidIso = (value) => typeof value === 'string' && !isNaN(Date.parse(value));

  return { nowIso: nowIso, isValidIso: isValidIso };

})();
