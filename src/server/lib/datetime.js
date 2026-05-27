var DateTime = (function () {

  function nowIso() {
    return new Date().toISOString();
  }

  function isValidIso(value) {
    return typeof value === 'string' && !isNaN(Date.parse(value));
  }

  return { nowIso: nowIso, isValidIso: isValidIso };

})();
